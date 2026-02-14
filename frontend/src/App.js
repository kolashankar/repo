import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import axios from 'axios';
import { Toaster, toast } from 'sonner';
import AdminDashboard from './pages/AdminDashboard';
import ProposalScene from './components/ProposalScene';
import { retryApiCall } from './utils/apiRetry';
import './App.css';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

function ProposalWrapper() {
    const [proposalData, setProposalData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch random proposal
                const res = await retryApiCall(async () => {
                    return await axios.get(`${API}/public/random-proposal`);
                }, 3, 1000);
                
                if (res.data && res.data.categories && res.data.categories.length > 0) {
                    setProposalData(res.data);
                } else {
                    setError(true);
                    toast.error('No proposals found! Ask admin to add some.');
                }
            } catch (e) {
                console.error("Error fetching proposal:", e);
                setError(true);
                toast.error('Failed to load proposal. Check connection.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-pink-50">
                <div className="text-2xl font-bold text-pink-500 animate-pulse">Loading Surprise... 💖</div>
            </div>
        );
    }

    if (error || !proposalData) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 bg-pink-50">
                <div className="text-xl text-red-500">Unable to load proposal.</div>
                <button 
                    onClick={() => window.location.reload()} 
                    className="rounded-full bg-pink-500 px-6 py-2 text-white hover:bg-pink-600"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="main-container">
            <div className="content-wrapper">
                <ProposalScene proposalData={proposalData} />
            </div>
        </div>
    );
}

function App() {
  return (
    <div className="App font-sans">
        <Toaster position="top-center" richColors />
        <Routes>
          <Route path="/" element={<ProposalWrapper />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
    </div>
  );
}

export default App;
