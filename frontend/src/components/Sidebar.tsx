import { useEffect, useState } from "react";
import { useFileStore } from "../store/useFileStore";
import { getMetadata, updateMetadata } from "../api/client";

export const Sidebar = () => {
  const selectedFileId = useFileStore((state) => state.selectedFileId);
  
  // Локальний стейт полів
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedFileId) return;

    const fetchMeta = async () => {
      setIsLoading(true);
      try {
        const data = await getMetadata(selectedFileId);
        setTitle(data.title);
        setDescription(data.description);
      } catch (error) {
        console.error("Error loading metadata", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMeta();
  }, [selectedFileId]);

  const handleBlur = async () => {
    if (!selectedFileId) return;
    try {
      await updateMetadata(selectedFileId, { title, description });
    } catch (error) {
      console.error("Could not save changes.", error);
    }
  };

  if (!selectedFileId) {
    return <div className="p-4 text-gray-500">Select a photo to edit</div>;
  }

  return (
    <aside className="w-80 border-l p-4 bg-white h-screen overflow-y-auto">
      <h2 className="text-lg font-bold mb-4">File metadata</h2>
      
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Назва (Title)</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-blue-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleBlur}
              placeholder="Enter the stock name..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Опис (Description)</label>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm h-32 focus:outline-blue-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleBlur}
              placeholder="Detailed description for buyers..."
            />
          </div>
        </div>
      )}
    </aside>
  );
};