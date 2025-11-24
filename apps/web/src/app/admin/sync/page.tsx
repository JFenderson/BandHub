import React, { useState, useEffect } from 'react';

const SyncManagement = () => {
  const [bands, setBands] = useState([]);
  const [syncStatus, setSyncStatus] = useState({});

  useEffect(() => {
    // Fetch bands from API or state management
    const fetchBands = async () => {
      const response = await fetch('/api/bands'); // Placeholder for the actual API call
      const data = await response.json();
      setBands(data);
    };

    fetchBands();
  }, []);

  const triggerSync = async (bandId) => {
    // Placeholder for actual sync logic
    if (bandId) {
      setSyncStatus((prev) => ({ ...prev, [bandId]: 'Syncing...' }));
      await fetch(`/api/sync/${bandId}`, { method: 'POST' });
      setSyncStatus((prev) => ({ ...prev, [bandId]: 'Sync Complete' }));
    } else {
      setSyncStatus({});
      await fetch('/api/sync/all', { method: 'POST' });
      setSyncStatus({ all: 'Sync Complete' });
    }
  };

  return (
    <div>
      <h1>Sync Management</h1>
      <button onClick={() => triggerSync()}>Sync All Bands</button>
      <ul>
        {bands.map((band) => (
          <li key={band.id}>
            <span>{band.name}</span>
            <button onClick={() => triggerSync(band.id)}>Sync</button>
            {syncStatus[band.id] && <span> - {syncStatus[band.id]}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SyncManagement;
