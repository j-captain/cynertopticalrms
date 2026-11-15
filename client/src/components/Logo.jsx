const Logo = ({ size = 40, withText = true, className = '' }) => (
  <div className={`flex items-center gap-2.5 ${className}`}>
    <img src="/logo.svg" width={size} height={size} alt="Cynert Optical" />
    {withText && (
      <div className="leading-tight">
        <div className="font-extrabold text-slate-900 tracking-tight">Cynert Optical</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold">
          Records Management
        </div>
      </div>
    )}
  </div>
);

export default Logo;