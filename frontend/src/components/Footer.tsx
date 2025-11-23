import React from 'react';
import './Footer.css';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-content">
        <span>Aplicació d'ús intern per la Gerència d'Atenció Pimària i Comunitària de Barcelonés nord i Maresme • © {currentYear} GAPiCBNM • Construït i desenvolupat per Marc Carrera Mas.</span>
      </div>
    </footer>
  );
};

export default Footer; 