import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { FortuneWheelModal } from './components/FortuneWheelModal';
import { WalletDashboardPage } from './pages/WalletDashboardPage';
import { PayoutPage } from './pages/PayoutPage';
import { TransactionHistoryPage } from './pages/TransactionHistoryPage';
import { WithdrawalHistoryPage } from './pages/WithdrawalHistoryPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ApiDocsPage } from './pages/ApiDocsPage';

export default function App() {
  const { user, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>('wallet');

  // Loading screen during initial token verification
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFF9F0] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-[#800020] border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <h2 className="text-lg font-bold text-[#172554]">Connecting to VELoop Rewards...</h2>
          <p className="text-xs text-slate-500 mt-1">Verifying cryptographic ledger & database state</p>
        </div>
      </div>
    );
  }

  // Handle protected page routing
  const renderPage = () => {
    // If not authenticated and not on login/register/api-docs, show login
    if (!user) {
      if (currentPage === 'register') {
        return <RegisterPage onNavigate={setCurrentPage} />;
      }
      if (currentPage === 'api-docs') {
        return <ApiDocsPage />;
      }
      return <LoginPage onNavigate={setCurrentPage} />;
    }

    switch (currentPage) {
      case 'wallet':
        return <WalletDashboardPage onNavigate={setCurrentPage} />;
      case 'payout':
        return <PayoutPage onNavigate={setCurrentPage} />;
      case 'transactions':
        return <TransactionHistoryPage />;
      case 'withdrawals':
        return <WithdrawalHistoryPage onNavigate={setCurrentPage} />;
      case 'admin':
        if (user.role !== 'admin') {
          return (
            <div className="max-w-2xl mx-auto py-16 px-4 text-center">
              <div className="p-8 rounded-3xl bg-white border border-rose-200 shadow-md">
                <h2 className="text-xl font-bold text-rose-700">Access Restricted</h2>
                <p className="text-xs text-slate-600 mt-2">
                  The Admin Console is reserved for system administrators. Please sign in with the Demo Admin account (admin@veloop.test) to access administrative controls.
                </p>
                <button
                  onClick={() => setCurrentPage('wallet')}
                  className="mt-6 px-6 py-2.5 rounded-xl bg-[#172554] text-white font-bold text-xs cursor-pointer"
                >
                  Return to My Wallet
                </button>
              </div>
            </div>
          );
        }
        return <AdminDashboardPage />;
      case 'api-docs':
        return <ApiDocsPage />;
      case 'login':
        return <WalletDashboardPage onNavigate={setCurrentPage} />;
      case 'register':
        return <WalletDashboardPage onNavigate={setCurrentPage} />;
      default:
        return <WalletDashboardPage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9F0] text-[#172554] flex flex-col selection:bg-[#800020] selection:text-white">
      <Navbar currentPage={currentPage} onNavigate={setCurrentPage} />
      
      <main className="flex-1">
        {renderPage()}
      </main>

      <Footer onNavigate={setCurrentPage} />
      
      <FortuneWheelModal />
    </div>
  );
}
