'use client';

import React, { useState } from 'react';
import { Trophy, BookOpen, Users, Calendar, Star } from 'lucide-react';

interface OptionData {
    id: number;
    background: string;
    icon: React.ElementType; // Cambiado a componente Lucide
    main: string;
    sub: string;
    defaultColor: string;
}

const OptionsSelector: React.FC = () => {
    const [activeOption, setActiveOption] = useState<number>(0);

    const optionsData: OptionData[] = [
        {
            id: 0,
            background: '/options/option-bg-1.jpg',
            icon: Trophy,
            main: 'Sede Principal',
            sub: 'Instalaciones modernas para tu desarrollo',
            defaultColor: '#ED5565',
        },
        {
            id: 1,
            background: '/options/option-bg-2.jpg',
            icon: BookOpen,
            main: 'Campus Central',
            sub: 'Espacios de estudio y colaboración',
            defaultColor: '#FC6E51',
        },
        {
            id: 2,
            background: '/options/option-bg-3.jpg',
            icon: Users,
            main: 'Intercambio',
            sub: 'Conoce estudiantes de todo el mundo',
            defaultColor: '#FFCE54',
        },
        {
            id: 3,
            background: '/options/option-bg-4.png',
            icon: Star,
            main: 'Comité Consultivo',
            sub: 'Líderes que guían nuestra visión',
            defaultColor: '#2ECC71',
        },
        {
            id: 4,
            background: '/options/option-bg-5.webp',
            icon: Calendar,
            main: 'Vida Estudiantil',
            sub: 'Eventos y actividades exclusivas',
            defaultColor: '#5D9CEC',
        },
    ];

    const handleOptionClick = (optionId: number) => {
        setActiveOption(optionId);
    };

    const styles = `
    .options-container {
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      width: 100%;
      height: 400px; /* Adjusted height */
      font-family: inherit;
      transition: 0.25s;
    }
    
    .options-wrapper {
      display: flex;
      flex-direction: row;
      align-items: stretch;
      overflow: hidden;
      width: 100%;
      height: 100%;
    }
    
    .option-item {
      position: relative;
      overflow: hidden;
      min-width: 60px;
      margin: 10px;
      background-size: cover;
      background-position: center;
      cursor: pointer;
      transition: 0.5s cubic-bezier(0.05, 0.61, 0.41, 0.95);
      border-radius: 30px;
      flex-grow: 1;
      box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
    }
    
    .option-item.active {
      flex-grow: 10000;
      transform: scale(1);
      margin: 0px;
      border-radius: 40px;
    }
    
    .option-item.active .option-shadow {
      box-shadow: inset 0 -120px 120px -60px rgba(0,0,0,0.8);
    }
    
    .option-item:not(.active) .option-shadow {
      bottom: -40px;
      box-shadow: inset 0 -120px 120px -60px rgba(0,0,0,0.8);
    }
    
    .option-item.active .option-label {
      bottom: 20px;
      left: 20px;
    }
    
    .option-item:not(.active) .option-label {
      bottom: 10px;
      left: 10px;
    }
    
    .option-item.active .option-info > div {
      left: 0px;
      opacity: 1;
    }
    
    .option-item:not(.active) .option-info > div {
      left: 20px;
      opacity: 0;
    }
    
    .option-shadow {
      position: absolute;
      bottom: 0px;
      left: 0px;
      right: 0px;
      height: 120px; /* Reduced from 120px to avoid covering too much */
      background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
      pointer-events: none;
      transition: 0.5s cubic-bezier(0.05, 0.61, 0.41, 0.95);
    }
    
    .option-label {
      display: flex;
      position: absolute;
      right: 0px;
      height: 40px;
      transition: 0.5s cubic-bezier(0.05, 0.61, 0.41, 0.95);
      z-index: 10;
    }
    
    .option-icon {
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
      min-width: 40px;
      max-width: 40px;
      height: 40px;
      border-radius: 100%;
      background-color: white;
    }
    
    .option-info {
      display: flex;
      flex-direction: column;
      justify-content: center;
      margin-left: 10px;
      color: white;
      white-space: pre;
    }
    
    .option-info > div {
      position: relative;
      transition: 0.5s cubic-bezier(0.05, 0.61, 0.41, 0.95), opacity 0.5s ease-out;
    }
    
    .option-main {
      font-weight: bold;
      font-size: 1.2rem;
    }
    
    .option-sub {
      transition-delay: 0.1s;
      font-size: 0.8rem;
      opacity: 0.8;
    }
    
    .inactive-options {
      display: none;
    }
    
    /* Tablet and Mobile Responsive Styles */
    @media screen and (max-width: 1024px) {
      .options-container {
        height: auto;
        min-height: 400px;
        flex-direction: column;
      }
      
      .options-wrapper {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: auto;
        align-items: center;
        gap: 15px;
      }
      
      .option-item {
         width: 100%;
         height: 60px;
         min-height: 60px;
         margin: 0;
         flex-grow: 0;
         border-radius: 20px;
      }

      /* Active option takes full width and proper height */
      .option-item.active {
        display: block;
        width: 100%;
        height: 300px;
        border-radius: 25px;
        flex-grow: 0;
      }
      
      /* Ensure content is in bottom left */
      .option-item.active .option-label {
        bottom: 25px;
        left: 25px;
        right: auto;
        height: 40px;
      }
      
      .option-item.active .option-info > div {
        left: 0px;
        opacity: 1;
      }
      
      /* Show inactive options as compact bars */
      .option-item:not(.active) {
        display: flex;
        align-items: center;
        padding-left: 10px;
      }
      
      .option-item:not(.active) .option-label {
        position: relative;
        bottom: auto;
        left: auto;
        right: auto;
      }

       .option-item:not(.active) .option-info {
         display: none; /* Hide text on inactive mobile items to save space? Or show main? */
       }

       /* Only show icon for inactive on mobile */
    }
    
    @media screen and (max-width: 768px) {
        .option-item.active {
            height: 250px;
        }
    }
  `;

    return (
        <div className="w-full my-8 bg-bb-card rounded-3xl p-4 md:p-6 border border-bb-border shadow-xl overflow-hidden">
            <style dangerouslySetInnerHTML={{ __html: styles }} />

            <div className="options-container">
                <div className="options-wrapper">
                    {optionsData.map((option) => (
                        <div
                            key={option.id}
                            className={`option-item ${activeOption === option.id ? 'active' : ''}`}
                            style={{
                                backgroundImage: `url(${option.background})`,
                            }}
                            onClick={() => handleOptionClick(option.id)}
                        >
                            <div className="option-shadow"></div>
                            <div className="option-label">
                                <div
                                    className="option-icon"
                                    style={{
                                        color: option.defaultColor,
                                        boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                    }}
                                >
                                    <option.icon size={20} />
                                </div>
                                <div className="option-info">
                                    <div className="option-main">{option.main}</div>
                                    <div className="option-sub">{option.sub}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default OptionsSelector;
