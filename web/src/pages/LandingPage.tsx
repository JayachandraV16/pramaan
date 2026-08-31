import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { reportsApi } from '../api/reports.api';
import { CategoryApprovalStat, MonthlyTrendStat } from '../types';

// Images & Media from extracted resources
import banner1 from '@/emaap_extracted_resources/static/media/Banner1b.d80b8a0b4ce3d22c648e.jpg';
import banner2 from '@/emaap_extracted_resources/static/media/Banner2b.bf77a947cab6007a419a.jpg';
import banner3 from '@/emaap_extracted_resources/static/media/Banner3b.48c75ac3c59b300d3193.jpg';
import overviewImg from '@/emaap_extracted_resources/static/media/overview.f6e5299ccd1944edec6d.png';
import step1Img from '@/emaap_extracted_resources/static/media/1.aa361debdf6367c02e06.jpg';
import step3Img from '@/emaap_extracted_resources/static/media/3.fe227c904904ad6539b6.jpg';
import step4Img from '@/emaap_extracted_resources/static/media/4.3f5816f32dfe650e9789.jpg';
import statesBg from '@/emaap_extracted_resources/static/media/states-bg.97dd7fe1f6581370564d.png';

// Genuine SVG icons
import iconFastSecure from '@/emaap_extracted_resources/static/media/fastandsecure.daf59fbe4522382ddd49e9953f348297.svg';
import iconFastProc from '@/emaap_extracted_resources/static/media/fastprocessing.ba9259b219b78ec4890728c740fca8a3.svg';
import iconRealtime from '@/emaap_extracted_resources/static/media/realtime-status.0ed5d0c441f97b6071b5e5ea15835a4b.svg';
import iconLegislation from '@/emaap_extracted_resources/static/media/legislation.6de5f5a587ce50c03cd0a59e7db07754.svg';
import iconRules from '@/emaap_extracted_resources/static/media/rules-acts.cfcc63678be5ebb4b04a927c1ba8f7ad.svg';
import iconFunctions from '@/emaap_extracted_resources/static/media/functions-lm.cfe7138e48843a5760683e1b3f4db5a6.svg';
import iconSubOffices from '@/emaap_extracted_resources/static/media/subordinates-offices.0bdf395a4c50b209f50d3384f40faeac.svg';
import iconId from '@/emaap_extracted_resources/static/media/clms-id.8fd284347fe4eb92973a17c4b5ead316.svg';
import iconLogin from '@/emaap_extracted_resources/static/media/clms-login.00531b439dc7f6f73d514c799448fb4b.svg';
import iconDesktop from '@/emaap_extracted_resources/static/media/clms-desktop.5423220759ed7cedd8a41d09cce4a8c2.svg';
import iconDoc from '@/emaap_extracted_resources/static/media/clms-document.eb9ec0873229a7a0763ffa5590901764.svg';
import iconArrow from '@/emaap_extracted_resources/static/media/clms-arrow.e47fae9e97b63d65d36d2174491fd7cc.svg';

// State silhouette maps
import stateMh from '@/emaap_extracted_resources/static/media/maharashtra.b08a9b278285bfa8e9fe86b1158ba024.svg';
import stateUp from '@/emaap_extracted_resources/static/media/uttar-pradesh.eb124a58ec0b15a3c30d2426470446ad.svg';
import stateMp from '@/emaap_extracted_resources/static/media/bg-mp.746798794d1b8acb975f.png';
import stateKa from '@/emaap_extracted_resources/static/media/karnataka.2e8487aa698fef086f5d2d3528f2fceb.svg';
import stateCg from '@/emaap_extracted_resources/static/media/chhattisgarh.feeb5aafdf6975e2741fd2afdf1a1009.svg';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [certType, setCertType] = useState('Verification');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBanner, setActiveBanner] = useState(0);
  const [categoryData, setCategoryData] = useState<CategoryApprovalStat[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendStat[]>([]);
  const [selectedYear, setSelectedYear] = useState('2023-24');
  const [isLoadingCharts, setIsLoadingCharts] = useState(true);
  const [chartsError, setChartsError] = useState<string | null>(null);

  const banners = [banner1, banner2, banner3];

  useEffect(() => {
    loadChartData();
    const interval = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const loadChartData = async () => {
    setIsLoadingCharts(true);
    setChartsError(null);
    try {
      const [cats, trends] = await Promise.all([
        reportsApi.getCategoryWiseApprovals(),
        reportsApi.getLastSixMonthsTrend(),
      ]);
      setCategoryData(cats);
      setMonthlyTrend(trends);
    } catch (err: any) {
      setChartsError(err?.message || 'Failed to load live statistics.');
    } finally {
      setIsLoadingCharts(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/verify-public?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const pieColors = ['#FFAA17', '#F87171', '#FB923C', '#FBBF24'];

  const statesList = [
    { name: 'Maharashtra', gradient: 'from-[#FF6B35] to-[#F85A20]', icon: stateMh },
    { name: 'Uttar Pradesh', gradient: 'from-[#8B44F7] to-[#7322E2]', icon: stateUp },
    { name: 'Madhya Pradesh', gradient: 'from-[#EBA834] to-[#D98E16]', icon: stateMp },
    { name: 'Odisha', gradient: 'from-[#0A66C2] to-[#084D94]', icon: stateKa },
    { name: 'Rajasthan', gradient: 'from-[#E86228] to-[#C9470F]', icon: stateCg },
  ];

  return (
    <div className="w-full bg-white text-[#222429] min-h-screen scroll-smooth">
      {/* 1. HERO SECTION & BANNER (Screenshots 1 & 2) */}
      <section id="hero" className="relative w-full bg-[#1a1a2e] overflow-hidden">
        {/* Background Image Carousel with overlay */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {banners.map((b, idx) => (
            <img
              key={idx}
              src={b}
              alt={`Banner ${idx + 1}`}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                activeBanner === idx ? 'opacity-35' : 'opacity-0'
              }`}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        </div>

        {/* Hero Top Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-20 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column: 5-Step Process & Live Document Preview (Screenshot 1) */}
            <div className="lg:col-span-6 flex flex-col sm:flex-row items-center gap-6">
              {/* Step Workflow */}
              <div className="space-y-3 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider w-28 text-right">
                    LOGIN
                  </span>
                  <div className="w-8 h-8 rounded-full bg-[#037DEE] text-white flex items-center justify-center font-bold text-xs shadow-md">
                    ➔
                  </div>
                  <span className="w-5 h-5 rounded-full bg-white text-[#1a1a2e] font-bold text-[10px] flex items-center justify-center">1</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider w-28 text-right">
                    COMPLETE PROFILE
                  </span>
                  <div className="w-8 h-8 rounded-full bg-[#FF6B35] text-white flex items-center justify-center font-bold text-xs shadow-md">
                    🪪
                  </div>
                  <span className="w-5 h-5 rounded-full bg-white text-[#1a1a2e] font-bold text-[10px] flex items-center justify-center">2</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider w-28 text-right">
                    SUBMIT APPLICATION
                  </span>
                  <div className="w-8 h-8 rounded-full bg-[#6B46C1] text-white flex items-center justify-center font-bold text-xs shadow-md">
                    📄
                  </div>
                  <span className="w-5 h-5 rounded-full bg-white text-[#1a1a2e] font-bold text-[10px] flex items-center justify-center">3</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider w-28 text-right">
                    GET APPROVAL
                  </span>
                  <div className="w-8 h-8 rounded-full bg-[#10B981] text-white flex items-center justify-center font-bold text-xs shadow-md">
                    ✓
                  </div>
                  <span className="w-5 h-5 rounded-full bg-white text-[#1a1a2e] font-bold text-[10px] flex items-center justify-center">4</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider w-28 text-right">
                    DOWNLOAD CERTIFICATE
                  </span>
                  <div className="w-8 h-8 rounded-full bg-[#FFAA17] text-white flex items-center justify-center font-bold text-xs shadow-md">
                    📜
                  </div>
                  <span className="w-5 h-5 rounded-full bg-white text-[#1a1a2e] font-bold text-[10px] flex items-center justify-center">5</span>
                </div>
              </div>

              {/* Approved Document Preview Card */}
              <div className="relative bg-white p-4 rounded-xl shadow-2xl border border-slate-200 rotate-1 max-w-[220px] text-[9px] text-slate-800 space-y-1.5 select-none hidden sm:block">
                <div className="text-center font-bold text-[10px] border-b pb-1 text-[#1a1a2e]">
                  GOVERNMENT OF INDIA
                </div>
                <p className="font-semibold text-slate-900">Certificate of Model Approval</p>
                <p className="text-slate-500 text-[8px] leading-tight">Legal Metrology Act, 2009 & General Rules, 2011</p>
                <div className="h-16 bg-slate-100 rounded border border-slate-200 flex flex-col items-center justify-center text-[8px] text-slate-400 p-1">
                  <span>Standard Laboratory Weights</span>
                  <span className="text-[7px]">Calibration Class M1/E2</span>
                </div>
                {/* Rubber Stamp */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="border-2 border-emerald-600 text-emerald-600 font-extrabold text-sm px-2.5 py-0.5 rounded uppercase -rotate-12 bg-white/90 shadow-md">
                    APPROVED
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Search Card & Heading (Screenshot 1) */}
            <div className="lg:col-span-6 space-y-4">
              <span className="inline-block px-3 py-1 rounded-md bg-black/60 text-[#FFAA17] text-xs font-bold uppercase tracking-wider">
                Easy Approvals
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight">
                Get Easy Approvals of Your Certificates and Licences
              </h1>

              {/* Track Form Card */}
              <div className="bg-[#222429]/80 backdrop-blur-md rounded-xl p-5 border border-white/10 text-white space-y-3 shadow-xl">
                <h2 className="text-sm font-bold text-white">Know Your Certificate/Licence Status</h2>
                <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={certType}
                    onChange={(e) => setCertType(e.target.value)}
                    className="px-3 py-2.5 bg-white text-[#222429] text-xs rounded-md font-medium border-0 focus:ring-2 focus:ring-[#FFAA17]"
                  >
                    <option value="Verification">Select Certificate</option>
                    <option value="Verification">Weights & Measures</option>
                    <option value="Model Approval">Model Approval</option>
                    <option value="Importer">Importer Licence</option>
                  </select>

                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={searchQuery}
                      maxLength={25}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Enter certificate number"
                      className="w-full px-3 py-2.5 bg-white text-[#222429] text-xs rounded-md font-medium border-0 focus:ring-2 focus:ring-[#FFAA17] pr-12"
                    />
                    <span className="absolute right-2 top-3 text-[10px] text-slate-400 font-mono">
                      {searchQuery.length}/25
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#FFAA17] hover:bg-[#f8aa24] text-[#1a1a2e] font-extrabold text-xs uppercase tracking-wider rounded-md transition-colors shrink-0 shadow-sm"
                  >
                    SUBMIT
                  </button>
                </form>

                <p className="text-[10px] text-slate-300 leading-tight">
                  *Search certificates issued from 18/12/2024 onwards. Previously issued certificates can be viewed{' '}
                  <button
                    type="button"
                    onClick={() => setSearchQuery('CERT-LM-MH-2026-098124')}
                    className="text-[#FFAA17] underline font-bold"
                  >
                    here
                  </button>.
                </p>
              </div>
            </div>
          </div>

          {/* 3 Floating Feature Cards (Screenshot 2) */}
          <div className="pt-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1 */}
              <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 space-y-2">
                <div className="w-10 h-10 bg-[#222429] rounded-md flex items-center justify-center p-2">
                  <img src={iconFastSecure} alt="Secure And Easy" className="w-full h-full object-contain" />
                </div>
                <h3 className="font-extrabold text-base text-[#222429]">Secure And Easy</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  A secure platform streamlines certification and licence renewal with user-friendly digital tools.
                </p>
              </div>

              {/* Card 2 */}
              <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 space-y-2">
                <div className="w-10 h-10 bg-[#222429] rounded-md flex items-center justify-center p-2">
                  <img src={iconFastProc} alt="Fast Processing" className="w-full h-full object-contain" />
                </div>
                <h3 className="font-extrabold text-base text-[#222429]">Fast Processing</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  A robust platform ensures swift processing of certificate applications, enhancing efficiency in regulatory compliance.
                </p>
              </div>

              {/* Card 3 */}
              <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 space-y-2">
                <div className="w-10 h-10 bg-[#222429] rounded-md flex items-center justify-center p-2">
                  <img src={iconRealtime} alt="Real-Time Status" className="w-full h-full object-contain" />
                </div>
                <h3 className="font-extrabold text-base text-[#222429]">Real-Time Status & Tracking</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  In the realm of applications, a platform offers real-time status updates and tracking.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. OVERVIEW SECTION (Screenshots 2 & 3) */}
      <section id="overview" className="w-full bg-white py-16 scroll-mt-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left: Collage Image */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              <div className="relative">
                <img
                  src={overviewImg}
                  alt="Overview Legal Metrology"
                  className="w-full max-w-md h-auto object-contain rounded-lg shadow-sm"
                />
                <div className="absolute -left-3 top-8 bottom-8 w-2 bg-[#FFAA17] rounded-full hidden sm:block" />
              </div>
            </div>

            {/* Right: Overview Text & 4 Items */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-3">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#222429]">Overview</h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Explore a Centralized Legal Metrology System where regulatory oversight and measurement standards converge on a unified platform. This system simplifies certification, verification, and compliance across sectors, ensuring consistent, accurate, and transparent weights and measures for commercial transactions.The platform enhances efficiency in monitoring and enforcement, bolstering consumer protection and fairness in the marketplace
                </p>
              </div>

              <div className="space-y-4 pt-2">
                {/* 1. Legislation */}
                <div className="flex items-start gap-4">
                  <img src={iconLegislation} alt="Legislation" className="w-8 h-8 object-contain shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h3 className="font-extrabold text-sm text-[#222429]">Legislation</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      The Act received the assent of the President on the 13th January, 2010 and came into force with effect from 1st April, 2011.
                    </p>
                  </div>
                </div>

                {/* 2. Rules & Act */}
                <div id="rules" className="flex items-start gap-4 scroll-mt-20">
                  <img src={iconRules} alt="Rules & Act" className="w-8 h-8 object-contain shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h3 className="font-extrabold text-sm text-[#222429]">Rules & Act</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Specifications for weighing and measuring instruments have been prescribed in the Legal Metrology (General) Rules, 2011
                    </p>
                  </div>
                </div>

                {/* 3. Functions of the Legal Metrology */}
                <div className="flex items-start gap-4">
                  <img src={iconFunctions} alt="Functions" className="w-8 h-8 object-contain shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h3 className="font-extrabold text-sm text-[#222429]">Functions of the Legal Metrology</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      A transparent and efficient legal metrology system inspires confidence in trade, industry and consumer and brings harmonious environment for conducting business.
                    </p>
                  </div>
                </div>

                {/* 4. Attached/ Subordinate Office */}
                <div className="flex items-start gap-4">
                  <img src={iconSubOffices} alt="Subordinate Office" className="w-8 h-8 object-contain shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h3 className="font-extrabold text-sm text-[#222429]">Attached/ Subordinate Office</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Regional Reference Standard Laboratories (RRSLs). Indian Institute of Legal Metrology, Ranchi
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. ONBOARD PROCESS SECTION (Screenshots 4 & 5) */}
      <section id="onboard" className="w-full bg-[#F4F5F8] py-16 border-y border-slate-200 scroll-mt-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center">
            <span className="inline-block px-5 py-2 rounded-md bg-[#222429] text-white font-extrabold text-sm uppercase tracking-wider shadow-sm">
              <span className="text-[#FFAA17]">pramaan</span> Onboard Process
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1: REGISTRATION */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-200 flex flex-col justify-between group">
              <div className="h-44 w-full overflow-hidden relative">
                <img src={step1Img} alt="Registration" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <img src={iconArrow} alt="Arrow" className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 hidden lg:block brightness-200" />
              </div>
              <div className="flex bg-[#FFAA17]">
                <div className="w-8 bg-[#222429] text-white text-[10px] font-extrabold flex items-center justify-center [writing-mode:vertical-lr] rotate-180 py-2 shrink-0">
                  1. REGISTRATION
                </div>
                <div className="p-3.5 space-y-1.5 flex-1">
                  <img src={iconId} alt="ID" className="w-5 h-5 object-contain" />
                  <p className="text-xs text-[#222429] font-medium leading-tight">
                    Users have to register themselves on the CLMS portal.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2: LOGIN */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-200 flex flex-col justify-between group">
              <div className="h-44 w-full overflow-hidden relative bg-[#222429] flex items-center justify-center">
                <img src={banner2} alt="Login" className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-300" />
                <img src={iconArrow} alt="Arrow" className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 hidden lg:block brightness-200" />
              </div>
              <div className="flex bg-[#FFAA17]">
                <div className="w-8 bg-[#222429] text-white text-[10px] font-extrabold flex items-center justify-center [writing-mode:vertical-lr] rotate-180 py-2 shrink-0">
                  2. LOGIN
                </div>
                <div className="p-3.5 space-y-1.5 flex-1">
                  <img src={iconLogin} alt="Login" className="w-5 h-5 object-contain" />
                  <p className="text-xs text-[#222429] font-medium leading-tight">
                    After Registration, Login to the account basis of details filled during registration.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3: MAKE PROFILE */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-200 flex flex-col justify-between group">
              <div className="h-44 w-full overflow-hidden relative">
                <img src={step3Img} alt="Make Profile" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <img src={iconArrow} alt="Arrow" className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 hidden lg:block brightness-200" />
              </div>
              <div className="flex bg-[#FFAA17]">
                <div className="w-8 bg-[#222429] text-white text-[10px] font-extrabold flex items-center justify-center [writing-mode:vertical-lr] rotate-180 py-2 shrink-0">
                  3. MAKE PROFILE
                </div>
                <div className="p-3.5 space-y-1.5 flex-1">
                  <img src={iconDesktop} alt="Desktop" className="w-5 h-5 object-contain" />
                  <p className="text-xs text-[#222429] font-medium leading-tight">
                    Complete the profile in few steps to get personalized Dashboard.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 4: APPLY */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-200 flex flex-col justify-between group">
              <div className="h-44 w-full overflow-hidden relative">
                <img src={step4Img} alt="Apply" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
              <div className="flex bg-[#FFAA17]">
                <div className="w-8 bg-[#222429] text-white text-[10px] font-extrabold flex items-center justify-center [writing-mode:vertical-lr] rotate-180 py-2 shrink-0">
                  4. APPLY
                </div>
                <div className="p-3.5 space-y-1.5 flex-1">
                  <img src={iconDoc} alt="Document" className="w-5 h-5 object-contain" />
                  <p className="text-xs text-[#222429] font-medium leading-tight">
                    Apply and Track Application request through personalized Dashboard.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. SELECT STATE AND SUBMIT YOUR REQUEST (Screenshots 5 & 6) */}
      <section
        id="states"
        className="w-full py-16 bg-cover bg-center scroll-mt-14"
        style={{ backgroundImage: `url(${statesBg})` }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#222429]">
              Select State and Submit Your Request
            </h2>
          </div>

          {/* 5 State Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {statesList.map((st) => (
              <div
                key={st.name}
                onClick={() => navigate('/applications/new')}
                className={`bg-gradient-to-b ${st.gradient} text-white p-5 rounded-2xl shadow-lg relative min-h-[220px] flex flex-col justify-between cursor-pointer hover:-translate-y-1 transition-all overflow-hidden group`}
              >
                {/* State Silhouette Map */}
                <img
                  src={st.icon}
                  alt={st.name}
                  className="absolute right-0 bottom-0 w-32 h-32 object-contain opacity-20 group-hover:opacity-35 transition-opacity pointer-events-none"
                />

                <div className="space-y-2 relative z-10">
                  <h3 className="font-extrabold text-base text-white">{st.name}</h3>
                  <p className="text-[11px] text-white/90 leading-tight">
                    Let's delve into the application process for certificates.
                  </p>
                </div>

                <div className="relative z-10 pt-4">
                  <div className="w-8 h-8 rounded-full bg-white text-[#222429] flex items-center justify-center font-bold text-xs shadow-md group-hover:bg-[#FFAA17] transition-colors">
                    ↗
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. EMPOWER ROLE, SUBMIT REQUEST (Screenshots 6 & 7) */}
      <section id="empower" className="w-full py-16 bg-white scroll-mt-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#222429]">
              Empower <span className="text-[#FFAA17]">Role</span>, Submit Request
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <div className="rounded-xl overflow-hidden shadow-md border border-slate-200 flex flex-col justify-between group">
              <div className="h-48 w-full overflow-hidden bg-slate-100">
                <img src={step1Img} alt="Importers" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
              <div className="bg-[#FFAA17] p-4 flex flex-col justify-between min-h-[110px]">
                <h3 className="font-bold text-xs text-[#222429] leading-snug">
                  Certificates of Importers of Weights & Measures
                </h3>
                <div
                  onClick={() => navigate('/applications/new')}
                  className="flex items-center justify-between pt-2 cursor-pointer"
                >
                  <span className="text-xs font-semibold text-[#222429]">Visit Portal</span>
                  <div className="w-6 h-6 rounded-full bg-[#222429] text-white flex items-center justify-center text-xs">
                    ➔
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="rounded-xl overflow-hidden shadow-md border border-slate-200 flex flex-col justify-between group">
              <div className="h-48 w-full overflow-hidden bg-slate-100">
                <img src={banner3} alt="Directors" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
              <div className="bg-[#FFAA17] p-4 flex flex-col justify-between min-h-[110px]">
                <h3 className="font-bold text-xs text-[#222429] leading-snug">
                  Directors of the Companies Nominated
                </h3>
                <div
                  onClick={() => navigate('/applications/new')}
                  className="flex items-center justify-between pt-2 cursor-pointer"
                >
                  <span className="text-xs font-semibold text-[#222429]">Visit Portal</span>
                  <div className="w-6 h-6 rounded-full bg-[#222429] text-white flex items-center justify-center text-xs">
                    ➔
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="rounded-xl overflow-hidden shadow-md border border-slate-200 flex flex-col justify-between group">
              <div className="h-48 w-full overflow-hidden bg-slate-100">
                <img src={banner2} alt="Model Approval" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
              <div className="bg-[#FFAA17] p-4 flex flex-col justify-between min-h-[110px]">
                <h3 className="font-bold text-xs text-[#222429] leading-snug">
                  Model Approvel System
                </h3>
                <div
                  onClick={() => navigate('/applications/new')}
                  className="flex items-center justify-between pt-2 cursor-pointer"
                >
                  <span className="text-xs font-semibold text-[#222429]">Visit Portal</span>
                  <div className="w-6 h-6 rounded-full bg-[#222429] text-white flex items-center justify-center text-xs">
                    ➔
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4 */}
            <div className="rounded-xl overflow-hidden shadow-md border border-slate-200 flex flex-col justify-between group">
              <div className="h-48 w-full overflow-hidden bg-slate-100">
                <img src={step4Img} alt="Packaged Commodities" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
              <div className="bg-[#FFAA17] p-4 flex flex-col justify-between min-h-[110px]">
                <h3 className="font-bold text-xs text-[#222429] leading-snug">
                  Packaged Commodities Registration
                </h3>
                <div
                  onClick={() => navigate('/applications/new')}
                  className="flex items-center justify-between pt-2 cursor-pointer"
                >
                  <span className="text-xs font-semibold text-[#222429]">Visit Portal</span>
                  <div className="w-6 h-6 rounded-full bg-[#222429] text-white flex items-center justify-center text-xs">
                    ➔
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. LETS GET INSIGHTS (Screenshots 7 & 8) */}
      <section id="insights" className="w-full py-16 bg-[#F4F5F8] border-t border-slate-200 scroll-mt-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#222429]">
              Lets Get Insights
            </h2>
          </div>

          {isLoadingCharts ? (
            <LoadingSpinner label="Fetching insights data..." />
          ) : chartsError ? (
            <ErrorMessage message={chartsError} onRetry={loadChartData} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Donut Chart (Categories Wise Approvals) */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-[#222429]">Categories Wise Approvals</h3>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="px-3 py-1 bg-slate-50 border border-slate-300 rounded-md text-xs font-bold text-slate-700"
                  >
                    <option value="2023-24">2023-24</option>
                    <option value="2024-25">2024-25</option>
                    <option value="2025-26">2025-26</option>
                  </select>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="approvals"
                        nameKey="categoryLabel"
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={120}
                        paddingAngle={2}
                      >
                        {categoryData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => [Number(v).toLocaleString('en-IN'), 'Approvals']} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right: Grouped Bar Chart (Last Six Month Approvals) */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-[#222429]">Last Six Month Approvals</h3>
                  <div className="flex items-center gap-4 text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-slate-800">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#1a1a2e]" /> Submitted
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FFAA17]" /> Approved
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-500">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF584E]" /> Rejected
                    </span>
                  </div>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#475569' }} />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#475569' }}
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                      />
                      <Tooltip formatter={(v: any) => [Number(v).toLocaleString('en-IN'), '']} />
                      <Bar dataKey="submitted" fill="#1a1a2e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="approved" fill="#FFAA17" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="rejected" fill="#FF584E" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 7. STAY UPDATED SECTION (Screenshots 9 & 10) */}
      <section id="updates" className="w-full py-16 bg-white border-t border-slate-200 scroll-mt-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#222429]">
              Stay <span className="px-3 py-1 rounded-md bg-[#FFAA17] text-[#1a1a2e]">Updated</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* News 1 */}
            <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                <img src={step1Img} alt="News 1" className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 bg-[#FFAA17] text-[#1a1a2e] font-extrabold text-[10px] text-center px-2 py-1 rounded shadow-sm">
                  <p className="text-xs leading-none">6</p>
                  <p className="leading-none mt-0.5">SEPT</p>
                </div>
              </div>
              <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <h3 className="font-extrabold text-sm text-[#222429] leading-snug">
                    Penalty for violations of rules on measurement, weights of store goods to be raised in Delhi
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    The Delhi Govt. is poised to raise penalties for violations of laid down guidelines against the use of non-standard weights and measurement for loose and packaged goods...
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100">
                  <span className="text-[11px] text-slate-600 font-semibold flex items-center gap-1 hover:text-[#FFAA17] cursor-pointer">
                    Read full article about Penalty for violations... ➔
                  </span>
                </div>
              </div>
            </div>

            {/* News 2 */}
            <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                <img src={step4Img} alt="News 2" className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 bg-[#FFAA17] text-[#1a1a2e] font-extrabold text-[10px] text-center px-2 py-1 rounded shadow-sm">
                  <p className="text-xs leading-none">26</p>
                  <p className="leading-none mt-0.5">JUL</p>
                </div>
              </div>
              <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <h3 className="font-extrabold text-sm text-[#222429] leading-snug">
                    Centre wants 'country of origin' filter on shopping apps
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    The Centre has floated a proposal asking e-commerce platforms to add a 'country of origin' filter to their websites and apps, a move aimed at helping consumers make quicker informed choices...
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100">
                  <span className="text-[11px] text-slate-600 font-semibold flex items-center gap-1 hover:text-[#FFAA17] cursor-pointer">
                    Read full article about Centre wants 'country of origin'... ➔
                  </span>
                </div>
              </div>
            </div>

            {/* News 3 */}
            <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                <img src={banner3} alt="News 3" className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 bg-[#FFAA17] text-[#1a1a2e] font-extrabold text-[10px] text-center px-2 py-1 rounded shadow-sm">
                  <p className="text-xs leading-none">14</p>
                  <p className="leading-none mt-0.5">APR</p>
                </div>
              </div>
              <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <h3 className="font-extrabold text-sm text-[#222429] leading-snug">
                    Govt frames draft rules for gas meters to protect consumers
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    The government has drafted new rules requiring testing, verification and stamping of all domestic, commercial, and industrial gas meters before they can be used in trade...
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100">
                  <span className="text-[11px] text-slate-600 font-semibold flex items-center gap-1 hover:text-[#FFAA17] cursor-pointer">
                    Read full article about Govt frames draft rules for gas meters... ➔
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
