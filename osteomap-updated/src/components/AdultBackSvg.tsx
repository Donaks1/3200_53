import React from 'react';

export const AdultBackSvg = ({ onBoneTap, states, searchHighlight }: { onBoneTap: (id: string) => void, states: Record<string, string>, searchHighlight: string[] }) => {
  const getColor = (id: string) => {
    const state = states[id];
    if (searchHighlight.includes(id)) {
      return 'stroke-blue-500 stroke-[4px]'; 
    }
    switch (state) {
      case 'complete': return 'fill-green-500 stroke-green-700';
      case 'absent': return 'fill-transparent stroke-gray-400 opacity-50 stroke-[2px] border-dashed';
      case 'fragmentary': return 'fill-[url(#diagonalHatch)] stroke-yellow-700';
      default: return 'fill-gray-200 stroke-gray-500 hover:fill-gray-300';
    }
  };

  const handleClick = (e: React.MouseEvent<SVGElement>) => {
    const target = e.target as SVGElement;
    if (target.id) {
      onBoneTap(target.id);
    }
  };

  return (
    <svg width="400" height="800" viewBox="0 0 400 800" xmlns="http://www.w3.org/2000/svg" onClick={handleClick}>
      <defs>
        <pattern id="diagonalHatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#fde047" />
          <line x1="0" y1="0" x2="0" y2="10" stroke="#ca8a04" strokeWidth="4" />
        </pattern>
      </defs>

      <text x="200" y="50" textAnchor="middle" className="fill-gray-500 text-sm">Posterior View Placeholder</text>

      {/* Skull Back */}
      <g id="skull_back" className="cursor-pointer">
        <circle id="skull_back_cranium" cx="200" cy="80" r="40" className={`${getColor('skull_front_cranium')} transition-colors duration-200`} />
      </g>

      {/* Spine (Simplified) */}
      <g id="spine" className="cursor-pointer">
        <rect id="vertebrae_cervical" x="195" y="120" width="10" height="30" className={`${getColor('vertebrae_cervical')} transition-colors duration-200`} />
        <rect id="vertebrae_thoracic" x="190" y="150" width="20" height="80" className={`${getColor('vertebrae_thoracic')} transition-colors duration-200`} />
        <rect id="vertebrae_lumbar" x="190" y="230" width="20" height="40" className={`${getColor('vertebrae_lumbar')} transition-colors duration-200`} />
      </g>

      {/* Scapula */}
      <path id="scapula_L" d="M210 150 L 250 150 L 230 200 Z" className={`${getColor('scapula_L')} transition-colors duration-200`} />
      <path id="scapula_R" d="M190 150 L 150 150 L 170 200 Z" className={`${getColor('scapula_R')} transition-colors duration-200`} />

      {/* Left Arm (viewer's left, patient's left because it's back view) */}
      <g id="arm_L_back" className="cursor-pointer">
        <rect id="humerus_L_shaft" x="120" y="140" width="20" height="90" rx="10" className={`${getColor('humerus_L_shaft')} transition-colors duration-200`} />
        <rect id="radius_L_shaft" x="120" y="240" width="10" height="80" rx="5" className={`${getColor('radius_L_shaft')} transition-colors duration-200`} />
        <rect id="ulna_L_shaft" x="135" y="240" width="10" height="80" rx="5" className={`${getColor('ulna_L_shaft')} transition-colors duration-200`} />
        <circle id="hand_L" cx="130" cy="340" r="15" className={`${getColor('hand_L')} transition-colors duration-200`} />
      </g>

      {/* Right Arm */}
      <g id="arm_R_back" className="cursor-pointer">
        <rect id="humerus_R_shaft" x="260" y="140" width="20" height="90" rx="10" className={`${getColor('humerus_R_shaft')} transition-colors duration-200`} />
        <rect id="radius_R_shaft" x="270" y="240" width="10" height="80" rx="5" className={`${getColor('radius_R_shaft')} transition-colors duration-200`} />
        <rect id="ulna_R_shaft" x="255" y="240" width="10" height="80" rx="5" className={`${getColor('ulna_R_shaft')} transition-colors duration-200`} />
        <circle id="hand_R" cx="265" cy="340" r="15" className={`${getColor('hand_R')} transition-colors duration-200`} />
      </g>

      {/* Pelvis Back */}
      <path id="pelvis_L_back" d="M200 280 L 150 280 L 140 320 L 200 340 Z" className={`${getColor('pelvis_L')} transition-colors duration-200`} />
      <path id="pelvis_R_back" d="M200 280 L 250 280 L 260 320 L 200 340 Z" className={`${getColor('pelvis_R')} transition-colors duration-200`} />

      {/* Left Leg */}
      <g id="leg_L_back" className="cursor-pointer">
        <rect id="femur_L_shaft" x="160" y="340" width="25" height="120" rx="10" className={`${getColor('femur_L_shaft')} transition-colors duration-200`} />
        <rect id="tibia_L_shaft" x="165" y="490" width="15" height="110" rx="5" className={`${getColor('tibia_L_shaft')} transition-colors duration-200`} />
        <rect id="fibula_L_shaft" x="152" y="490" width="8" height="110" rx="4" className={`${getColor('fibula_L_shaft')} transition-colors duration-200`} />
        <path id="foot_L" d="M150 610 L 185 610 L 190 630 L 140 630 Z" className={`${getColor('foot_L')} transition-colors duration-200`} />
      </g>

      {/* Right Leg */}
      <g id="leg_R_back" className="cursor-pointer">
        <rect id="femur_R_shaft" x="215" y="340" width="25" height="120" rx="10" className={`${getColor('femur_R_shaft')} transition-colors duration-200`} />
        <rect id="tibia_R_shaft" x="220" y="490" width="15" height="110" rx="5" className={`${getColor('tibia_R_shaft')} transition-colors duration-200`} />
        <rect id="fibula_R_shaft" x="240" y="490" width="8" height="110" rx="4" className={`${getColor('fibula_R_shaft')} transition-colors duration-200`} />
        <path id="foot_R" d="M215 610 L 250 610 L 260 630 L 210 630 Z" className={`${getColor('foot_R')} transition-colors duration-200`} />
      </g>
    </svg>
  );
};
