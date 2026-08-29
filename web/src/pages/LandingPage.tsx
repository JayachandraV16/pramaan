import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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
  const [certType, setCertType] = useState('Weights & Measures');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBanner, setActiveBanner] = useState(0);
  const banners = [banner1, banner2, banner3];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/verify-public?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

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
                    className="px-3 py-2.5 bg-white text-[#222429] text-xs rounded-md font-medium border-0 focus:ring-2 focus:ring-[#FFAA17] cursor-pointer"
                  >
                    <option value="">Select Certificate</option>
                    <option value="Weights & Measures">Weights & Measures</option>
                    <option value="Model Approval">Model Approval</option>
                    <option value="Importer Licence">Importer Licence</option>
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
    </div>
  );
};
