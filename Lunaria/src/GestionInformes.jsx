import {useState} from 'react';

export default function GestionInformes({sesion}){
 const hoy=new Date();
 const [periodo,setPeriodo]=useState('mes');
 const [valor,setValor]=useState(`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`);
 const [sedeId,setSedeId]=useState('todas');
 const [sedes,setSedes]=useState([]);
 const [datos,setDatos]=useState(null),[error,setError]=useState(''),[cargando,setCargando]=useState(false);
 const consultar=async()=>{
  setCargando(true);setError('');
  try{
   const params=new URLSearchParams({periodo,valor,sedeId});
   const r=await fetch(`https://lunariasuites.onrender.com/api/informes/estadisticas?${params.toString()}`,{headers:{Authorization:`Bearer ${sesion?.token||localStorage.getItem('lunariaToken')||''}`}});
   const d=await r.json();if(!r.ok)throw new Error(d.mensaje||'No se pudo consultar el informe.');setSedes(d.sedes||[]);setDatos(d);
  }catch(e){setError(e.message);}finally{setCargando(false);}
 };
 const cop=n=>Number(n||0).toLocaleString('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0,maximumFractionDigits:0});

 const cambiarPeriodo=e=>{const p=e.target.value;setPeriodo(p);setDatos(null);setValor(p==='mes'?`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`:String(hoy.getFullYear()));};
 return <section className="roles-header-card lunaria-reports" style={{display:'block'}}>
  <h2>Informes y estadísticas</h2>
  <div className="lunaria-report-filters">
   <label>Consultar por<select value={periodo} onChange={cambiarPeriodo}><option value="mes">Mes</option><option value="anio">Año</option></select></label>
   <label>{periodo==='mes'?'Mes':'Año'}<input type={periodo==='mes'?'month':'number'} min={periodo==='mes'?'2000':2000} max={periodo==='mes'?undefined:2100} value={valor} onChange={e=>setValor(e.target.value)}/></label>
   <label>Sede<select value={sedeId} onChange={e=>{setSedeId(e.target.value);setDatos(null);}}><option value="todas">Todas las sedes</option>{sedes.map(s=><option key={s.idSedes} value={s.idSedes}>{s.nombre}</option>)}</select></label>
   <button onClick={consultar} disabled={cargando||!valor}>{cargando?'Consultando…':'Consultar'}</button>
  </div>
  {error&&<p role="alert">{error}</p>}
  {datos&&<>
   <h3>Resumen global del hotel · {periodo==='mes'?'Mes':'Año'} {datos.valor}</h3>
   <div className="admin-stats-grid lunaria-report-kpis">
    <article><strong>{cop(datos.ingresosTotales)}</strong><span>Ingresos totales globales (IVA incluido)</span><small>Subtotal: {cop(datos.subtotalGlobal)} · IVA ({datos.ivaPorcentaje}%): {cop(datos.ivaGlobal)}</small></article>
    <article><strong>{Number(datos.totalReservas||0).toLocaleString('es-CO')}</strong><span>Total de reservas global</span></article>
    <article><strong>{Number(datos.ocupacionPorcentaje||0).toLocaleString('es-CO')}%</strong><span>Ocupación general</span></article>
   </div>
   <h3>Rendimiento por sede</h3>
   <p className="lunaria-report-scope">{sedeId==='todas'?'Se muestran todas las sedes.':'Se muestra la sede seleccionada.'} Los indicadores superiores siempre representan el hotel completo.</p>
   <div className="roles-table-container lunaria-report-table-wrap"><table className="lunaria-report-table"><thead><tr><th>Sede</th><th>Total de reservas</th><th>Subtotal</th><th>IVA ({datos.ivaPorcentaje}%)</th><th>Ingresos totales</th><th>Ocupación</th></tr></thead>
    <tbody>{(datos.porSede||[]).map(s=><tr key={s.idSedes}><th scope="row">{s.sede}</th><td>{Number(s.reservas||0).toLocaleString('es-CO')}</td><td>{cop(s.subtotal)}</td><td>{cop(s.iva)}</td><td><strong>{cop(s.ingresosTotales)}</strong></td><td>{Number(s.ocupacionPorcentaje||0).toLocaleString('es-CO')}%</td></tr>)}
     <tr className="lunaria-report-total"><th scope="row">TOTAL GENERAL · TODAS LAS SEDES</th><td>{Number(datos.totalGeneralSedes?.reservas||0).toLocaleString('es-CO')}</td><td>{cop(datos.totalGeneralSedes?.subtotal)}</td><td>{cop(datos.totalGeneralSedes?.iva)}</td><td>{cop(datos.totalGeneralSedes?.ingresosTotales)}</td><td>—</td></tr>
    </tbody></table></div>
   <small className="lunaria-report-note">El desglose de IVA se calcula a partir del total registrado, considerando que el valor ya incluye IVA y aplicando la tarifa configurada ({datos.ivaPorcentaje}%).</small>
  </>}
 </section>;
}
