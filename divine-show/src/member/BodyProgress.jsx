import { useState } from 'react';
import { Camera, Maximize2, Ruler, X } from 'lucide-react';
import { formatLongDate, number } from '../marathon/model';
import { MEASUREMENT_FIELDS, PHOTO_STAGES } from './bodyProgressData';

export function MeasurementDashboard({ logs = [], title = 'Динамика замеров' }) {
  const available = MEASUREMENT_FIELDS.filter((field) => logs.some((log) => valueExists(log[field.id])));
  const [selected, setSelected] = useState(available[0]?.id || 'weight');
  const field = available.find((item) => item.id === selected) || available[0];
  const points = field ? [...logs]
    .filter((log) => valueExists(log[field.id]))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((log) => ({ ...log, value: number(log[field.id]) })) : [];

  if (!field) return <section className="border border-dashed border-[#bdd3cd] bg-[#f5faf8] p-5 text-center rounded-lg"><Ruler className="mx-auto text-[#0d8b71]" /><h3 className="mt-2 font-black">График появится после первого замера</h3><p className="mt-1 text-xs font-bold text-slate-500">Добавь вес или объём, затем сохрани вторую точку для сравнения.</p></section>;

  const first = points[0];
  const last = points[points.length - 1];
  const delta = points.length > 1 ? Math.round((last.value - first.value) * 10) / 10 : null;
  const values = points.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max(0.5, (rawMax - rawMin) * 0.18);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const coordinates = points.map((point, index) => ({
    ...point,
    x: points.length === 1 ? 310 : 28 + (index / (points.length - 1)) * 564,
    y: 152 - ((point.value - min) / Math.max(1, max - min)) * 120,
  }));

  return <section className="border border-[#cfe0dc] bg-white p-4 rounded-lg"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-black uppercase text-[#0d735f]">Замеры</div><h3 className="mt-1 text-xl font-black">{title}</h3></div><div className="text-right"><strong className="text-xl" style={{ color: field.color }}>{last.value.toLocaleString('ru-RU')} {field.unit}</strong><small className="block font-bold text-slate-500">{delta === null ? 'Нужна ещё одна точка' : `${delta > 0 ? '+' : ''}${delta} ${field.unit} от старта`}</small></div></div><div className="mt-4 flex gap-1 overflow-x-auto pb-1">{available.map((item) => <button key={item.id} type="button" onClick={() => setSelected(item.id)} className={`shrink-0 px-3 py-2 text-xs font-black rounded-md ${field.id === item.id ? 'bg-[#15333b] text-white' : 'border border-[#d7e5e1] bg-white text-slate-500'}`}>{item.label}</button>)}</div><div className="mt-3 overflow-hidden border border-[#d7e5e1] bg-[#f8fbfb] rounded-md"><svg viewBox="0 0 620 180" role="img" aria-label={`График: ${field.label}`} className="block aspect-[31/9] min-h-[180px] w-full"><title>{field.label}: изменение по датам</title>{[32, 72, 112, 152].map((y) => <line key={y} x1="28" x2="592" y1={y} y2={y} stroke="#dfe8e6" strokeWidth="1" />)}{coordinates.length > 1 && <polyline points={coordinates.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={field.color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />}{coordinates.map((point) => <g key={point.id || point.date}><circle cx={point.x} cy={point.y} r="7" fill="white" stroke={field.color} strokeWidth="4" /><text x={point.x} y={Math.max(16, point.y - 13)} textAnchor="middle" fontSize="12" fontWeight="800" fill="#15333b">{point.value}</text></g>)}</svg><div className="flex justify-between border-t border-[#d7e5e1] px-3 py-2 text-[10px] font-black text-slate-500"><span>{formatLongDate(first.date)}</span><span>{formatLongDate(last.date)}</span></div></div></section>;
}

export function ProgressPhotoGallery({ logs = [], progressPhotos = [], title = 'Фото прогресса' }) {
  const [selected, setSelected] = useState(null);
  const photos = [
    ...logs.filter((item) => item.photoUrl).map((item) => ({ id: item.id, url: item.photoUrl, date: item.date, stage: item.photoStage })),
    ...progressPhotos.filter((item) => item.url || item.photoUrl).map((item) => ({ id: item.id, url: item.url || item.photoUrl, date: item.date, stage: item.stage })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date))).map((item, index) => ({ ...item, stage: item.stage || (index === 0 ? 'start' : 'checkpoint') }));

  return <section className="border border-[#cfe0dc] bg-white p-4 rounded-lg"><div className="flex items-center gap-2"><Camera size={19} className="text-[#0d8b71]" /><h3 className="text-xl font-black">{title}</h3></div>{photos.length ? <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{photos.map((photo) => { const stage = PHOTO_STAGES.find((item) => item.id === photo.stage) || PHOTO_STAGES[1]; return <button key={photo.id || `${photo.date}-${photo.url}`} type="button" onClick={() => setSelected({ ...photo, stage })} className="group relative overflow-hidden border border-[#d7e5e1] bg-[#eef5f3] text-left rounded-md"><img src={photo.url} alt={`${stage.label}, ${formatLongDate(photo.date)}`} className="aspect-[3/4] w-full object-cover transition duration-200 group-hover:scale-[1.02]" /><span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-black/65 p-2 text-white"><span><strong className="block text-xs">{stage.label}</strong><small className="text-[10px] font-bold">{formatLongDate(photo.date)}</small></span><Maximize2 size={16} /></span></button>; })}</div> : <div className="mt-4 border border-dashed border-[#bdd3cd] bg-[#f5faf8] p-5 text-center text-sm font-bold text-slate-400 rounded-md">Фотографий пока нет.</div>}{selected && <div role="dialog" aria-modal="true" aria-label="Просмотр фото прогресса" className="fixed inset-0 z-[80] grid place-items-center bg-[#102a43]/80 p-3"><section className="relative max-h-[94vh] w-full max-w-3xl overflow-hidden bg-white rounded-lg"><button type="button" onClick={() => setSelected(null)} className="icon-command absolute right-3 top-3 z-10" title="Закрыть"><X size={18} /></button><img src={selected.url} alt="Фото прогресса" className="max-h-[82vh] w-full bg-black object-contain" /><div className="p-4"><strong>{selected.stage.label}</strong><span className="ml-2 text-sm font-bold text-slate-500">{formatLongDate(selected.date)}</span></div></section></div>}</section>;
}

function valueExists(value) {
  return value !== '' && value !== null && value !== undefined && Number.isFinite(number(value));
}
