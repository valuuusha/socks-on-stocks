import { useState, useEffect } from "react";
import { useFileStore } from "../store/useFileStore";
import { getFtpProfiles, saveFtpProfile, testFtpConnection, uploadToFtp, FtpProfile } from "../api/client";

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

  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadErrorMsg, setUploadErrorMsg] = useState("");
  const [uploadSuccessCount, setUploadSuccessCount] = useState(0);

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

  const saveCurrentProfile = async () => {
    if (password) {
      const saved = await saveFtpProfile({ platform_name: platformName, host, port: 21, login, password, directory });
      setProfiles(prev => {
        const filtered = prev.filter(p => p.platform_name !== saved.platform_name);
        return [...filtered, saved];
      });
    }
  };

  const handleTestConnection = async () => {
    if (!platformName || !host || !login) {
      setTestStatus("Error: Fill in all required fields.");
      return;
    }
    setIsTesting(true);
    setTestStatus("Testing connection...");
    try {
      await saveCurrentProfile();
      const result = await testFtpConnection({ platform_name: platformName, host, port: 21, login, password, directory });
      setTestStatus(result.message);
    } catch (error: any) {
      setTestStatus(`Error: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleUpload = async () => {
    if (!platformName || !host || !login) return;
    
    setUploadStatus('uploading');
    try {
      await saveCurrentProfile();
      const res = await uploadToFtp({
        platform_name: platformName, host, port: 21, login, password, directory,
        file_ids: selectedFileIds
      });

      if (res.errors.length > 0 && res.success_count === 0) {
        setUploadErrorMsg(res.errors[0]);
        setUploadStatus('error');
      } else {
        setUploadSuccessCount(res.success_count);
        setUploadStatus('success');
      }
    } catch (err: any) {
      setUploadErrorMsg(err.message);
      setUploadStatus('error');
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
              <input className="ftp-input" value={host} onChange={e => setHost(e.target.value)} placeholder="ftp.example.com" />
            </div>
            <div className="ftp-form-group">
              <label>Login * :</label>
              <input className="ftp-input" value={login} onChange={e => setLogin(e.target.value)} placeholder="username" />
            </div>
            <div className="ftp-form-group">
              <label>Password :</label>
              <input className="ftp-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={profiles.some(p => p.platform_name === platformName) ? "•••••••• (Saved)" : "password"} />
            </div>
            <div className="ftp-form-group">
              <label>Directory :</label>
              <input className="ftp-input" value={directory} onChange={e => setDirectory(e.target.value)} placeholder="/" />
            </div>
            <button className="ftp-btn-test" onClick={handleTestConnection} disabled={isTesting || uploadStatus === 'uploading'}>
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
        <button className="ftp-btn-secondary" onClick={onBack} disabled={uploadStatus === 'uploading'}>Back to metadata</button>
        <button 
          className="ftp-btn-primary" 
          disabled={selectedFiles.length === 0 || !platformName || uploadStatus === 'uploading'}
          onClick={handleUpload}
        >
          {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload to FTP'}
        </button>
      </div>

      {uploadStatus === 'success' && (
        <div className="ftp-modal-overlay">
          <div className="ftp-modal-box ftp-modal-box--success">
            <svg className="ftp-modal-icon" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="1.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <h3 className="ftp-modal-title">Upload completed</h3>
            <p className="ftp-modal-text">All selected images were uploaded successfully to the FTP server.</p>
            <div className="ftp-modal-details">
              Uploaded files: {uploadSuccessCount} / {selectedFiles.length}<br/>
              Destination: {directory || "/"}<br/>
              FTP profile: {platformName}
              <br/><br/>
              Great job!<br/>Your files are ready for stock platform processing.
            </div>
            <div className="ftp-modal-actions">
              <button className="ftp-btn-secondary" onClick={() => setUploadStatus('idle')}>Back to FTP settings</button>
              <button className="ftp-btn-primary" onClick={() => { setUploadStatus('idle'); onBack(); }}>Done</button>
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'error' && (
        <div className="ftp-modal-overlay">
          <div className="ftp-modal-box ftp-modal-box--error">
            <svg className="ftp-modal-icon" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <h3 className="ftp-modal-title">Upload failed</h3>
            <p className="ftp-modal-text">Images could not be uploaded to the FTP server.</p>
            <div className="ftp-modal-details">
              Possible reason:<br/>
              <span style={{color: "#d32f2f"}}>{uploadErrorMsg}</span>
              <br/><br/>
              FTP profile: {platformName}
            </div>
            <div className="ftp-modal-actions">
              <button className="ftp-btn-secondary" onClick={() => setUploadStatus('idle')}>Check FTP settings</button>
              <button className="ftp-btn-primary" onClick={handleUpload}>Retry</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};