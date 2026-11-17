import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import './ModalSistema.css';

export default function ModalSistema({
  abierto = true,
  titulo = 'Mensaje del Sistema',
  mensaje,
  tipo = 'aviso',
  textoAceptar = 'Aceptar',
  textoCancelar = 'Cancelar',
  onAceptar,
  onCancelar,
}) {
  if (!abierto || typeof document === 'undefined') return null;
  const Icono = tipo === 'exito' ? CheckCircle2 : tipo === 'confirmacion' ? Info : AlertCircle;
  const confirmar = tipo === 'confirmacion';
  return createPortal(
    <div className="lunaria-system-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && onCancelar) onCancelar(); }}>
      <section className="lunaria-system-modal" role="dialog" aria-modal="true" aria-labelledby="lunaria-system-title">
        <div className={`lunaria-system-icon lunaria-system-icon-${tipo}`}><Icono size={27} /></div>
        <h3 id="lunaria-system-title">{titulo}</h3>
        <p>{mensaje}</p>
        <div className="lunaria-system-actions">
          {confirmar && <button type="button" className="lunaria-system-cancel" onClick={onCancelar}>{textoCancelar}</button>}
          <button type="button" className="lunaria-system-accept" onClick={onAceptar}>{textoAceptar}</button>
        </div>
      </section>
    </div>,
    document.body
  );
}
