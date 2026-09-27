import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Gauge,
  Loader2,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import { AI_PERIODS, analysisReadiness, buildAiSnapshot } from './analytics.js';
import { requestAiAnalysis, useAiReports } from './useAiAnalyst.js';

const STATUS = {
  on_track: { label: 'Курс держится', color: '#16865f', background: '#ecfbf3' },
  attention: { label: 'Нужна корректировка', color: '#a56112', background: '#fff7e8' },
  insufficient_data: { label: 'Мало данных', color: '#61717a', background: '#f2f5f6' },
};

const confidenceLabel = { high: 'высокая', medium: 'средняя', low: 'низкая' };

function signed(value, suffix = '') {
  if (value === null || value === undefined) return '—';
  return `${value > 0 ? '+' : ''}${value}${suffix}`;
}

function formatGeneratedAt(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AiAnalyst({ user, state, stats, lifeState, stepsState }) {
  const [period, setPeriod] = useState('week');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { reports, syncState, saveReport } = useAiReports(user);
  const snapshot = useMemo(
    () => buildAiSnapshot({ state, stats, lifeState, stepsState, period }),
    [lifeState, period, state, stats, stepsState],
  );
  const readiness = analysisReadiness(snapshot);
  const currentReport = reports.find((item) => item.period === period) || null;
  const current = snapshot.current;
  const trend = current.body.weightTrend?.weeklyKg;

  const analyze = async () => {
    if (!readiness.ready || loading) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const response = await requestAiAnalysis(user, snapshot);
      const report = {
        id: crypto.randomUUID(),
        period,
        periodLabel: snapshot.period.label,
        generatedAt: response.generatedAt || new Date().toISOString(),
        model: response.model || 'openai/gpt-oss-120b',
        snapshotDigest: response.snapshotDigest || '',
        analysis: response.analysis,
      };
      const saved = await saveReport(report);
      setNotice(saved.error || 'Разбор готов и сохранён.');
    } catch (failure) {
      setError(failure?.message || 'Не удалось получить разбор.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4">
      <section className="overflow-hidden border border-[#bfdbe5] bg-white rounded-lg">
        <div className="bg-[#102a43] px-4 py-5 text-white sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-black text-[#8bd7eb]"><BrainCircuit size={17} />ЖИВОЙ АНАЛИТИК</div>
              <h2 className="mt-2 text-2xl font-black">Не мнение. Разбор по твоим данным.</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#c8d9e6]">Расчёты делает приложение. Модель объясняет динамику, отделяет факты от гипотез и выбирает точки усиления.</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-black text-[#c8d9e6]"><ShieldCheck size={16} className="text-[#7be0ad]" />Только администратор</div>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-1 border border-[#d8e3e7] bg-[#f3f6f7] p-1 rounded-md sm:grid-cols-4">
            {AI_PERIODS.map((item) => <button key={item.id} type="button" onClick={() => { setPeriod(item.id); setError(''); setNotice(''); }} className={`min-h-10 px-2 text-xs font-black rounded-sm ${period === item.id ? 'bg-[#0d8fb9] text-white' : 'text-slate-500'}`}>{item.label}</button>)}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Signal label="Данных" value={`${snapshot.dataQuality.recordedDays}/${snapshot.dataQuality.expectedDays}`} detail={`${snapshot.dataQuality.completeness}% периода`} icon={<Gauge />} />
            <Signal label="Вес" value={current.body.lastWeight ? `${current.body.lastWeight} кг` : 'Нет данных'} detail={trend === null || trend === undefined ? 'тренд ещё не виден' : `${signed(trend, ' кг')} в неделю`} icon={<Scale />} />
            <Signal label="Энергобаланс" value={current.body.averageEnergyBalance === null ? 'Нет данных' : signed(current.body.averageEnergyBalance, ' ккал')} detail={`ожидание ${signed(current.body.expectedWeightChange, ' кг')}`} icon={<ArrowDownRight />} />
            <Signal label="Сильные дни" value={`${current.results.strongRate}%`} detail={`${current.results.strong} из ${current.results.total}`} icon={<Target />} />
          </div>

          <div className={`mt-4 flex items-start gap-3 border p-3 rounded-md ${readiness.ready ? 'border-[#b8e0cb] bg-[#f2fbf6]' : 'border-[#efd49f] bg-[#fff8e9]'}`}>
            {readiness.ready ? <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-[#16865f]" /> : <AlertTriangle size={19} className="mt-0.5 shrink-0 text-[#a56112]" />}
            <div className="min-w-0 flex-1"><strong className="block text-sm">{readiness.message}</strong>{snapshot.dataQuality.limits.length > 0 && <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">{snapshot.dataQuality.limits.join(' ')}</div>}</div>
          </div>

          <button type="button" disabled={!readiness.ready || loading} onClick={analyze} className="mt-4 inline-flex min-h-[50px] w-full items-center justify-center gap-2 bg-[#102a43] px-4 font-black text-white disabled:bg-slate-300 rounded-md sm:w-auto sm:min-w-64">
            {loading ? <Loader2 size={18} className="animate-spin" /> : currentReport ? <RefreshCw size={18} /> : <Sparkles size={18} />}
            {loading ? 'Сопоставляю факты…' : currentReport ? 'Обновить разбор' : 'Провести разбор'}
          </button>
          <p className="mt-3 max-w-3xl text-xs font-semibold leading-5 text-slate-400">При запуске структурированный снимок выбранного периода отправляется в Groq. Ключ остаётся на защищённом сервере, а идентификатор аккаунта модели не передаётся.</p>
          {error && <div role="alert" className="mt-3 border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800 rounded-md">{error}</div>}
          {notice && <div role="status" className="mt-3 border border-[#b8e0cb] bg-[#ecfbf3] p-3 text-sm font-bold text-[#16865f] rounded-md">{notice}</div>}
        </div>
      </section>

      {currentReport ? <AnalysisReport report={currentReport} syncState={syncState} /> : <EmptyReport />}
      {reports.length > 1 && <ReportHistory reports={reports} />}
    </div>
  );
}

function Signal({ label, value, detail, icon }) {
  return <div className="border border-[#d8e3e7] bg-[#f9fbfb] p-3 rounded-md"><div className="flex items-center gap-2 text-xs font-black text-slate-500"><span className="text-[#0d8fb9]">{icon}</span>{label}</div><div className="mt-2 text-xl font-black">{value}</div><div className="mt-1 text-xs font-bold text-slate-400">{detail}</div></div>;
}

function AnalysisReport({ report, syncState }) {
  const analysis = report.analysis;
  const status = STATUS[analysis.status] || STATUS.attention;
  return <section className="border border-[#d8e3e7] bg-white p-4 rounded-lg sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="text-xs font-black text-[#0d8fb9]">{report.periodLabel} · {formatGeneratedAt(report.generatedAt)}</div><h2 className="mt-1 text-2xl font-black">{analysis.headline}</h2></div>
      <div className="px-3 py-2 text-xs font-black rounded-md" style={{ color: status.color, background: status.background }}>{status.label}</div>
    </div>
    <p className="mt-4 max-w-4xl text-base font-semibold leading-7 text-slate-600">{analysis.summary}</p>

    <div className="mt-5 grid gap-3 lg:grid-cols-2">
      <ReportBlock title="Что видно по фактам" icon={<Gauge />}>
        <div className="grid gap-2">{analysis.facts.map((item, index) => <div key={`${item.title}-${index}`} className="border-l-4 border-[#0d8fb9] bg-[#f4f9fb] p-3"><strong className="block text-sm">{item.title}</strong><div className="mt-1 text-sm font-semibold leading-6 text-slate-600">{item.observation}</div><small className="mt-1 block font-bold text-slate-400">{item.evidence}</small></div>)}</div>
      </ReportBlock>
      <ReportBlock title="Динамика" icon={<ArrowUpRight />}>
        <div className="grid gap-2">{analysis.dynamics.map((item, index) => <div key={`${item.area}-${index}`} className="flex items-start gap-3 border border-[#e1e9ec] p-3 rounded-md"><TrendIcon trend={item.trend} /><div><strong className="text-sm">{item.area}</strong><p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{item.observation}</p></div></div>)}</div>
      </ReportBlock>
    </div>

    <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
      <ReportBlock title="Рабочие гипотезы" icon={<BrainCircuit />}>
        <div className="grid gap-2">{analysis.hypotheses.map((item, index) => <div key={`${item.hypothesis}-${index}`} className="border border-[#eadfdc] bg-[#fffaf9] p-3 rounded-md"><div className="flex items-center justify-between gap-2"><strong className="text-sm">{item.hypothesis}</strong><span className="shrink-0 text-[10px] font-black uppercase text-[#a56112]">уверенность: {confidenceLabel[item.confidence] || item.confidence}</span></div><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Проверка: {item.howToVerify}</p></div>)}</div>
      </ReportBlock>
      <ReportBlock title="Фокус сейчас" icon={<Target />}>
        <div className="grid gap-2">{analysis.priorities.map((item, index) => <div key={`${item.title}-${index}`} className="bg-[#102a43] p-3 text-white rounded-md"><div className="text-[10px] font-black text-[#8bd7eb]">ПРИОРИТЕТ {index + 1}</div><strong className="mt-1 block">{item.title}</strong><p className="mt-2 text-sm font-semibold leading-6 text-[#cfdeea]">{item.action}</p><div className="mt-2 text-xs font-black text-[#7be0ad]">Проверка: {item.metric}</div></div>)}</div>
      </ReportBlock>
    </div>

    <div className="mt-3 border border-[#b8e0cb] bg-[#ecfbf3] p-4 rounded-md"><div className="flex items-center gap-2 text-sm font-black text-[#16865f]"><Sparkles size={18} />Что уже становится сильнее</div><p className="mt-2 font-semibold leading-7 text-[#315d4a]">{analysis.reinforcement}</p></div>
    {analysis.dataLimits.length > 0 && <div className="mt-3 text-xs font-semibold leading-5 text-slate-400">Ограничения анализа: {analysis.dataLimits.join(' ')}</div>}
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#e1e9ec] pt-3 text-[11px] font-bold text-slate-400"><span>{report.model}</span><span>•</span><span>{syncState === 'synced' ? 'сохранено в облаке' : syncState === 'saving' ? 'сохраняется' : 'сохранено на устройстве'}</span></div>
  </section>;
}

function ReportBlock({ title, icon, children }) {
  return <section className="border border-[#d8e3e7] bg-white p-4 rounded-lg"><div className="mb-3 flex items-center gap-2 text-sm font-black text-[#102a43]"><span className="text-[#0d8fb9]">{icon}</span>{title}</div>{children}</section>;
}

function TrendIcon({ trend }) {
  const config = trend === 'up' ? { icon: <ArrowUpRight />, color: '#16865f', bg: '#ecfbf3' } : trend === 'down' ? { icon: <ArrowDownRight />, color: '#a7473e', bg: '#fff0ee' } : { icon: <ArrowRight />, color: '#61717a', bg: '#f2f5f6' };
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md" style={{ color: config.color, background: config.bg }}>{config.icon}</span>;
}

function EmptyReport() {
  return <section className="grid min-h-52 place-items-center border border-dashed border-[#b9dce8] bg-[#f7fbfc] p-6 text-center rounded-lg"><div><BrainCircuit size={34} className="mx-auto text-[#0d8fb9]" /><h3 className="mt-3 text-xl font-black">Здесь появится разбор пути</h3><p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500">Модель не будет оценивать тебя. Она сопоставит цифры, действия и контекст, а затем покажет факты, гипотезы и измеримые точки усиления.</p></div></section>;
}

function ReportHistory({ reports }) {
  return <details className="border border-[#d8e3e7] bg-white rounded-lg"><summary className="flex min-h-[54px] cursor-pointer items-center justify-between gap-3 px-4"><span className="flex items-center gap-2 font-black"><Clock3 size={18} className="text-[#0d8fb9]" />История разборов</span><ChevronDown size={18} /></summary><div className="grid gap-2 border-t border-[#e1e9ec] p-4">{reports.slice(0, 12).map((report) => <div key={report.id} className="flex items-center justify-between gap-3 border border-[#e1e9ec] p-3 rounded-md"><div><strong className="block text-sm">{report.analysis.headline}</strong><small className="mt-1 block font-bold text-slate-400">{report.periodLabel} · {formatGeneratedAt(report.generatedAt)}</small></div><span className="text-xs font-black text-[#0d8fb9]">{STATUS[report.analysis.status]?.label || 'Разбор'}</span></div>)}</div></details>;
}
