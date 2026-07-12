import React, { useState, useEffect } from 'react';
import { useAuth } from '../App.jsx';

export default function AdminDashboard() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch users
      const usersRes = await fetch('/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const usersData = await usersRes.json();
      
      // Fetch rides
      const ridesRes = await fetch('/api/rides/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const ridesData = await ridesRes.json();

      if (usersRes.ok && ridesRes.ok) {
        setUsers(usersData);
        setRides(ridesData);
      } else {
        throw new Error('Failed to load admin stats.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#05060a', color: 'white' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  // Calculate statistics
  const totalRiders = users.filter(u => u.role === 'rider').length;
  const totalDrivers = users.filter(u => u.role === 'driver').length;
  const completedRides = rides.filter(r => r.status === 'completed' || r.status === 'paid');
  const totalEarnings = completedRides.reduce((sum, r) => sum + r.fare, 0).toFixed(2);
  const activeTripsCount = rides.filter(r => ['accepted', 'arrived', 'started'].includes(r.status)).length;

  return (
    <div style={{ padding: '40px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }} className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', background: 'linear-gradient(135deg, white, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            System Administration
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.95rem' }}>Real-time statistics and ride lifecycle logger</p>
        </div>
        <button onClick={fetchAdminData} className="btn btn-secondary">
          🔄 Refresh Logs
        </button>
      </div>

      {error && (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', color: '#fca5a5', marginBottom: '30px' }}>
          {error}
        </div>
      )}

      {/* Stats Counter Grid */}
      <div className="admin-grid">
        <div className="stat-card glass-panel">
          <span className="label">Total System Earnings</span>
          <span className="value" style={{ color: '#10b981' }}>₹{totalEarnings}</span>
        </div>
        <div className="stat-card glass-panel">
          <span className="label">Active Trips</span>
          <span className="value" style={{ color: '#6366f1' }}>{activeTripsCount}</span>
        </div>
        <div className="stat-card glass-panel">
          <span className="label">Rider Accounts</span>
          <span className="value">{totalRiders}</span>
        </div>
        <div className="stat-card glass-panel">
          <span className="label">Driver Partners</span>
          <span className="value">{totalDrivers}</span>
        </div>
      </div>

      {/* Rides Logger Section */}
      <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'white' }}>System Ride Transactions</h3>
        
        {rides.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: '30px' }}>
            No ride records found in database.
          </div>
        ) : (
          <table className="admin-rides-table">
            <thead>
              <tr>
                <th>Ride ID</th>
                <th>Rider</th>
                <th>Driver</th>
                <th>Pickup Location</th>
                <th>Drop Destination</th>
                <th>Fare</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rides.map(r => (
                <tr key={r._id}>
                  <td style={{ fontFamily: 'monospace', color: '#818cf8' }}>
                    #{r._id.substring(18)}
                  </td>
                  <td>{r.riderId?.name || 'Unknown Rider'}</td>
                  <td>{r.driverId?.name || 'Unassigned'}</td>
                  <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={r.pickupAddress}>
                    {r.pickupAddress}
                  </td>
                  <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={r.dropAddress}>
                    {r.dropAddress}
                  </td>
                  <td style={{ fontWeight: 600 }}>₹{r.fare}</td>
                  <td>
                    <span 
                      style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: 
                          r.status === 'paid' ? 'rgba(16, 185, 129, 0.15)' :
                          ['accepted', 'arrived', 'started'].includes(r.status) ? 'rgba(99, 102, 241, 0.15)' :
                          r.status === 'requested' ? 'rgba(245, 158, 11, 0.15)' :
                          'rgba(239, 68, 68, 0.15)',
                        color: 
                          r.status === 'paid' ? '#34d399' :
                          ['accepted', 'arrived', 'started'].includes(r.status) ? '#818cf8' :
                          r.status === 'requested' ? '#fbbf24' :
                          '#fca5a5',
                        border: '1px solid currentColor'
                      }}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
