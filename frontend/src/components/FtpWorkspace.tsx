import { useState, useEffect } from "react";
import { useFileStore } from "../store/useFileStore";
import { getFtpProfiles, saveFtpProfile, testFtpConnection, FtpProfile } from "../api/client";

const KNOWN_PLATFORMS: Record<string, string> = {
  "Shutter Stock": "ftp.shutterstock.com",
  "Adobe Stock": "ftp.contributor.adobestock.com",
  "iStock": "ftp.gettyimages.com",
  "Depositphotos": "ftp.depositphotos.com",
  "Custom...": "",
};

type FtpWorkspaceProps = {
  onBack: () => void;
};

export const FtpWorkspace = ({ onBack }: FtpWorkspaceProps) => {
  const files = useFileStore((state) => state.files);
  const selectedFileIds = useFileStore((state) => state.selectedFileIds);
  
  const selectedFiles = files.filter(f => selectedFileIds.includes(f.id));
  const totalSizeKb = selectedFiles.reduce((acc, f) => acc + f.fileSizeKb, 0);
  const totalSizeMb = (totalSizeKb / 1024).toFixed(1);

  const [profiles, setProfiles] = useState<FtpProfile[]>([]);
  const [platformName, setPlatformName] = useState("");
  const [host, setHost] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [directory, setDirectory] = useState("/");
  
  const [testStatus, setTestStatus] = useState("Not tested");
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    getFtpProfiles().then(setProfiles).catch(console.error);
  }, []);

  const handlePlatformChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setPlatformName(selected);
    setTestStatus("Not tested");
    setPassword(""); 

    const existingProfile = profiles.find(p => p.platform_name === selected);
    
    if (existingProfile) {
      setHost(existingProfile.host);
      setLogin(existingProfile.login);
      setDirectory(existingProfile.directory || "/");
    } else {
      setHost(KNOWN_PLATFORMS[selected] || "");
      setLogin("");
      setDirectory("/");
    }
  };

  const handleTestConnection = async () => {
    if (!platformName || !host || !login) {
      setTestStatus("Error: Fill in all required fields.");
      return;
    }

    setIsTesting(true);
    setTestStatus("Testing connection...");

    const profileData = {
      platform_name: platformName,
      host,
      port: 21,
      login,
      password,
      directory,
    };

    try {
      if (password) {
        const saved = await saveFtpProfile(profileData);
        setProfiles(prev => {
          const filtered = prev.filter(p => p.platform_name !== saved.platform_name);
          return [...filtered, saved];
        });
      }
      
      await testFtpConnection(profileData);
      setTestStatus("Connection successful!");
    } catch (error: any) {
      setTestStatus(`Error: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="ftp-workspace">
      <div className="ftp-columns">
        <div className="ftp-settings-panel">
          <h2 className="ftp-panel-title">FTP connection settings</h2>
          <div className="ftp-panel-card">
            <p className="ftp-panel-desc">Configure FTP connection and upload selected images.</p>
            
            <div className="ftp-form-group">
              <label>Stock platform * :</label>
              <select className="ftp-input" value={platformName} onChange={handlePlatformChange}>
                <option value="" disabled>not selected</option>
                {Object.keys(KNOWN_PLATFORMS).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div className="ftp-form-group">
              <label>Host * :</label>
              <input 
                className="ftp-input" 
                value={host} 
                onChange={e => setHost(e.target.value)} 
                placeholder="ftp.example.com"
              />
            </div>

            <div className="ftp-form-group">
              <label>Login * :</label>
              <input 
                className="ftp-input" 
                value={login} 
                onChange={e => setLogin(e.target.value)} 
                placeholder="username"
              />
            </div>

            <div className="ftp-form-group">
              <label>Password :</label>
              <input 
                className="ftp-input" 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder={profiles.some(p => p.platform_name === platformName) ? "•••••••• (Saved)" : "password"}
              />
            </div>

            <div className="ftp-form-group">
              <label>Directory :</label>
              <input 
                className="ftp-input" 
                value={directory} 
                onChange={e => setDirectory(e.target.value)} 
                placeholder="/"
              />
            </div>

            <button 
              className="ftp-btn-test" 
              onClick={handleTestConnection}
              disabled={isTesting}
            >
              {isTesting ? "Testing..." : "Test connection"}
            </button>
            
            <p className={`ftp-status-text ${testStatus.startsWith("Error") ? "ftp-status-error" : testStatus.startsWith("Connection successful") ? "ftp-status-success" : ""}`}>
              Connection status: {testStatus}
            </p>
          </div>
        </div>

        <div className="ftp-files-panel">
          <h2 className="ftp-panel-title">Ready files</h2>
          <div className="ftp-panel-card ftp-panel-card--files">
            <div className="ftp-files-list">
              {selectedFiles.length === 0 ? (
                <div className="ftp-empty-files">No files selected for upload.</div>
              ) : (
                selectedFiles.map(file => (
                  <div key={file.id} className="ftp-file-item">
                    <img src={file.thumbnailUrl} alt="" className="ftp-file-thumb" />
                    <div className="ftp-file-info">
                      <div className="ftp-file-name">{file.filename}</div>
                      <div className="ftp-file-meta">
                        <span className="ftp-file-status">Ready</span>
                        <span className="ftp-file-size">JPEG • {(file.fileSizeKb / 1024).toFixed(1)} MB</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="ftp-files-summary">
              <span>Selected: {selectedFiles.length} files</span>
              <span>Total size: {totalSizeMb} MB</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ftp-actions-bottom">
        <button className="ftp-btn-secondary" onClick={onBack}>Back to metadata</button>
        <button className="ftp-btn-primary" disabled={selectedFiles.length === 0 || !platformName}>Upload to FTP</button>
      </div>
    </div>
  );
};