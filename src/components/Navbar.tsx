import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Coins, 
  Sparkles, 
  Gem, 
  CircleDollarSign, 
  Dices, 
  Wallet, 
  ArrowUpRight, 
  History, 
  ShieldCheck, 
  LogOut, 
  User as UserIcon, 
  Database,
  Menu,
  X,
  Gift,
  FileText
} from 'lucide-react';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate }) => {
  const { user, wallet, logout, dbStatus, setIsWheelModalOpen } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'payout', label: 'Payout', icon: ArrowUpRight },
    { id: 'transactions', label: 'Transactions', icon: History },
    { id: 'withdrawals', label: 'Withdrawals', icon: FileText },
    ...(user?.role === 'admin' ? [{ id: 'admin', label: 'Admin Portal', icon: ShieldCheck }] : []),
    { id: 'api-docs', label: 'API Docs', icon: FileText }
  ];

  const handleNav = (id: string) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#172554] text-white shadow-md border-b border-blue-900/60">
      {/* DB Engine Alert Sub-bar (if in embedded mode with notice) */}
      {dbStatus && (
        <div className={`px-4 py-1.5 text-xs font-medium flex items-center justify-between transition-colors ${
          dbStatus.mode === 'atlas' && dbStatus.connected 
            ? 'bg-emerald-950/80 text-emerald-200 border-b border-emerald-800/40' 
            : 'bg-amber-950/70 text-amber-200 border-b border-amber-800/40'
        }`}>
          <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
            <Database className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              Engine: <strong className="font-semibold">{dbStatus.mode === 'atlas' ? 'MongoDB Atlas Cluster' : 'High-Performance Embedded MongoDB'}</strong>
              {dbStatus.connected ? ' (Active & Synced)' : ' (Fallback Active)'}
            </span>
            {dbStatus.mode === 'embedded' && (
              <span className="hidden md:inline text-amber-300/80 text-[11px]">
                — Sandbox / Demo Ledger (in-memory; resets on restart)
              </span>
            )}
          </div>
          {dbStatus.mode === 'embedded' && user?.role === 'admin' && (
            <button
              onClick={() => onNavigate('admin')}
              className="text-[11px] underline hover:text-white transition-colors cursor-pointer flex-shrink-0 ml-2"
            >
              Configure Atlas Whitelist →
            </button>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => onNavigate('wallet')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#800020] to-[#4169E1] flex items-center justify-center shadow-inner border border-white/20">
              <Coins className="w-5 h-5 text-[#F4C542]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-[#FFF9F0] to-[#F4C542] bg-clip-text text-transparent">
                  VELoop
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#800020] text-[#FFF9F0] uppercase tracking-wider">
                  Rewards
                </span>
              </div>
              <p className="text-[10px] text-blue-200/80 tracking-wide">Wallet & Payout System</p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-800 text-white shadow-sm ring-1 ring-blue-700/50'
                      : 'text-blue-100 hover:bg-blue-900/60 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#F4C542]' : 'text-blue-300'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Currency Balances & User Status */}
          {user ? (
            <div className="hidden lg:flex items-center gap-3">
              {/* Currency Pills Bar */}
              {wallet && (
                <div className="flex items-center gap-1.5 bg-[#0e1738] p-1 rounded-xl border border-blue-900/80 text-xs">
                  {/* VEs (Primary spendable) */}
                  <div 
                    title="Spendable VEs"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#800020]/80 text-[#FFF9F0] font-semibold border border-red-500/30 shadow-xs"
                  >
                    <Coins className="w-3.5 h-3.5 text-[#F4C542]" />
                    <span>{wallet.ves.toLocaleString()}</span>
                    <span className="text-[10px] opacity-75 font-normal">VEs</span>
                  </div>

                  {/* SVEs (Staked) */}
                  <div 
                    title="Staked SVEs"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-950/60 text-blue-200"
                  >
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>{wallet.sves.toLocaleString()}</span>
                    <span className="text-[10px] opacity-70">SVEs</span>
                  </div>

                  {/* Gems */}
                  <div 
                    title="Gems"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-950/60 text-purple-200"
                  >
                    <Gem className="w-3 h-3 text-pink-400" />
                    <span>{wallet.gems.toLocaleString()}</span>
                  </div>

                  {/* Tokens */}
                  <div 
                    title="Tokens"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-950/60 text-amber-200"
                  >
                    <CircleDollarSign className="w-3 h-3 text-[#F4C542]" />
                    <span>{wallet.tokens.toLocaleString()}</span>
                  </div>

                  {/* Spins Button */}
                  <button
                    onClick={() => setIsWheelModalOpen(true)}
                    title="Click to spin the Fortune Wheel!"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold transition-all shadow-xs cursor-pointer group"
                  >
                    <Dices className="w-3.5 h-3.5 group-hover:rotate-45 transition-transform" />
                    <span>{wallet.spins}</span>
                    <span className="text-[10px]">Spins</span>
                  </button>
                </div>
              )}

              {/* User Menu / Logout */}
              <div className="flex items-center gap-2 pl-2 border-l border-blue-900">
                <div className="text-right">
                  <div className="text-xs font-semibold text-white leading-tight flex items-center gap-1.5 justify-end">
                    <span>{user.name}</span>
                    {user.role === 'admin' && (
                      <span className="bg-[#800020] text-amber-300 text-[9px] uppercase px-1 rounded font-mono font-bold">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-blue-300/80 truncate max-w-[120px]">{user.email}</div>
                </div>

                <button
                  onClick={logout}
                  title="Sign out of VELoop"
                  className="p-2 rounded-lg bg-blue-900/60 hover:bg-[#800020] text-blue-200 hover:text-white transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => onNavigate('login')}
                className="px-4 py-2 text-sm font-medium text-white hover:text-blue-200 transition-colors cursor-pointer"
              >
                Log In
              </button>
              <button
                onClick={() => onNavigate('register')}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#800020] hover:bg-[#9a0027] rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Register
              </button>
            </div>
          )}

          {/* Mobile hamburger menu button */}
          <div className="flex md:hidden items-center gap-2">
            {user && wallet && (
              <button
                onClick={() => setIsWheelModalOpen(true)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#F4C542] text-slate-950 text-xs font-bold"
              >
                <Dices className="w-3.5 h-3.5" />
                <span>{wallet.spins}</span>
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-blue-200 hover:text-white hover:bg-blue-800 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0e1738] border-b border-blue-900 px-4 pt-2 pb-4 space-y-3">
          {user && wallet && (
            <div className="grid grid-cols-3 gap-2 py-2 border-b border-blue-900/60 text-xs">
              <div className="bg-[#800020]/70 p-2 rounded text-center">
                <span className="text-[10px] text-red-200 block">VEs (Spendable)</span>
                <span className="font-bold text-white text-sm">{wallet.ves.toLocaleString()}</span>
              </div>
              <div className="bg-blue-950 p-2 rounded text-center">
                <span className="text-[10px] text-blue-300 block">Gems</span>
                <span className="font-bold text-white text-sm">{wallet.gems}</span>
              </div>
              <div className="bg-blue-950 p-2 rounded text-center">
                <span className="text-[10px] text-amber-300 block">Tokens</span>
                <span className="font-bold text-white text-sm">{wallet.tokens}</span>
              </div>
            </div>
          )}

          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    currentPage === item.id ? 'bg-blue-800 text-white' : 'text-blue-200 hover:bg-blue-900/60'
                  }`}
                >
                  <Icon className="w-4 h-4 text-[#F4C542]" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {user ? (
            <div className="pt-2 border-t border-blue-900/60 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">{user.name}</p>
                <p className="text-[10px] text-blue-300">{user.email}</p>
              </div>
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#800020] text-xs font-medium text-white"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          ) : (
            <div className="pt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => handleNav('login')}
                className="w-full py-2 text-center rounded-lg bg-blue-900 text-white text-sm font-medium"
              >
                Log In
              </button>
              <button
                onClick={() => handleNav('register')}
                className="w-full py-2 text-center rounded-lg bg-[#800020] text-white text-sm font-semibold"
              >
                Register
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
