import { useState } from 'react';
import { StoreProvider } from './context/StoreContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import BorrowForm from './components/BorrowForm';
import ReturnForm from './components/ReturnForm';
import Summary from './components/Summary';
import QRManagement from './components/QRManagement';
import Unserviceable from './components/Unserviceable';
import './App.css';

function App() {
    const [activeTab, setActiveTab] = useState('dashboard');

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <Dashboard />;
            case 'borrow': return <BorrowForm />;
            case 'return': return <ReturnForm />;
            case 'summary': return <Summary />;
            case 'qr-mgmt': return <QRManagement />;
            case 'unserviceable': return <Unserviceable />;
            default: return <Dashboard />;
        }
    };

    return (
        <StoreProvider>
            <Layout activeTab={activeTab} onTabChange={setActiveTab}>
                {renderContent()}
            </Layout>
        </StoreProvider>
    );
}

export default App;
