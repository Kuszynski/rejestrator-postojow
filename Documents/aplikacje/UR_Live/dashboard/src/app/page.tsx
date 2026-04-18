"use client";

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { AlertTriangle, Activity, Thermometer, ShieldAlert, Cpu, FolderUp, CloudDownload, CheckSquare, Square, TrendingUp, Settings, ToggleLeft, ToggleRight, ScrollText, Play } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ReferenceLine, ReferenceDot, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

const translateVerdict = (v: string | undefined | null) => {
  if (!v) return 'INAKTIV';
  let res = v;
  // Czyszczenie ikon z tekstu jeśli zajdzie potrzeba
  res = res.replace('IDLE', 'INAKTIV');
  res = res.replace('MONITORING', 'OVERVÅKING');
  res = res.replace('SERVICE', 'PLANLEGG SERVICE');
  res = res.replace('FIRE', 'BRANN/STOPP');
  res = res.replace('POŻAR/STOP', 'BRANN/STOPP');
  res = res.replace('CRITICAL', 'KRITISK ALARM');
  res = res.replace('ANOMALIA KRYTYCZNA', 'KRITISK ALARM');
  res = res.replace('ODCHYLENIE KRYTYCZNE', 'KRITISK ALARM');
  return res;
};

const getStatusColor = (verdict: string) => {
  if (!verdict) return 'bg-slate-800 border-slate-700';
  if (verdict.includes('BRANN') || verdict.includes('POŻAR') || verdict.includes('KRYTISK') || verdict.includes('KRYTYCZNA') || verdict.includes('STOPP')) return 'bg-red-950 border-red-700 text-red-100 shadow-[0_0_15px_rgba(220,38,38,0.5)]';
  if (verdict.includes('SERVICE') || verdict.includes('SERWIS')) return 'bg-yellow-950 border-yellow-700 text-yellow-100 shadow-[0_0_10px_rgba(202,138,4,0.3)]';
  if (verdict.includes('OVERVÅKING') || verdict.includes('MONITORING')) return 'bg-green-950 border-green-800 text-green-100 shadow-[0_0_8px_rgba(22,163,74,0.2)]';
  return 'bg-slate-800 border-slate-700 text-slate-300';
};

const getRelativeTime = (ts: string | number) => {
  try {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - d.getTime());
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Nå';
    if (diffMins < 60) return `${diffMins} min siden`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}t siden`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d siden`;
  } catch { return ''; }
};

const formatTime = (ts: string | number) => {
  try {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit' }) + ' ' +
      d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
  } catch { return String(ts); }
};

const getReactionTime = (timestamp: number, receivedTimestamp?: number) => {
  if (!receivedTimestamp) return null;
  const diffMs = receivedTimestamp - timestamp;
  if (diffMs <= 0) return null;

  const diffMins = Math.floor(diffMs / 60000);

  // Ukrywamy ogromne opóźnienia, które wynikają ze wczytywania starej historii 
  // np. gdy ktoś wyłączy komputer i włączy go następnego dnia
  if (diffMins > 2 * 60) return null; // Ukryj, jeśli opóźnienie jest większe niż 2 godziny

  if (diffMins < 1) return '+ < 1 min systemtid';

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours >= 1) return `+ ${diffHours}t ${diffMins % 60}m systemtid`;

  return `+ ${diffMins} min systemtid`;
};

const COLORS = ['#3b82f6', '#f97316', '#10b981', '#a855f7', '#ec4899'];

// --- MEMOIZED SUB-COMPONENTS ---

const SensorGrid = React.memo(({ sensorKeys, sensorsMap }: any) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto scrollbar-thin p-1">
      {sensorKeys.map((sn: string, idx: number) => {
        const last = sensorsMap[sn];
        const isFire = String(last?.FINAL_VERDICT || '').includes('POŻAR');
        const isService = String(last?.FINAL_VERDICT || '').includes('SERWIS');

        // Dark theme cards with glassmorphism traces
        const borderColor = isFire ? 'border-red-500/50 bg-red-950/20' : isService ? 'border-yellow-500/50 bg-yellow-950/10' : 'border-slate-700/50 bg-slate-800/30';
        const shadowGlow = isFire ? 'shadow-[0_0_15px_rgba(220,38,38,0.15)]' : isService ? 'shadow-[0_0_10px_rgba(202,138,4,0.1)]' : 'shadow-none';

        // Usunięcie potężnych przedrostków, by zmieścić nazwy
        const displaySn = sn.replace(/^api_/i, '');

        return (
          <div key={sn} className={`p-5 rounded-2xl border flex flex-col justify-between h-full backdrop-blur-sm transition-all duration-500 hover:border-slate-500 hover:bg-slate-800/60 ${borderColor} ${shadowGlow}`}>
            <div className="flex justify-between items-start mb-4 gap-2">
              <span className="font-bold text-sm tracking-tight text-white break-words leading-tight w-full">
                {last?.alias && last.alias !== displaySn ? `${last.alias} (${displaySn})` : displaySn}
              </span>
              {isFire ? <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse shrink-0 drop-shadow-[0_0_5px_rgba(220,38,38,0.8)]" /> : null}
            </div>

            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono font-medium p-2.5 bg-black/30 rounded-lg border border-white/5">
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 text-[9px] uppercase tracking-widest">Temp</span>
                  <span className="text-orange-400 flex items-center gap-1"><Thermometer className="w-3 h-3" /> {last?.temp_mean?.toFixed(1) || '--'}°</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 text-[9px] uppercase tracking-widest">Vibrasjon</span>
                  <span className="text-blue-400 flex items-center gap-1"><Activity className="w-3 h-3" /> {last?.vib_rms?.toFixed(2) || '--'}g</span>
                </div>
              </div>

              <div className={`text-[10px] font-black uppercase tracking-widest py-1.5 px-2 rounded mt-1 text-center ${getStatusColor(last?.FINAL_VERDICT)}`}>
                {translateVerdict(last?.FINAL_VERDICT) || 'INAKTIV'}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  );
});


const getAlarmDescription = (alert: any) => {
    if (!alert) return '';
    const textBlob = `${alert.alarm_source || ''} ${alert.type || ''} ${alert.FINAL_VERDICT || ''} ${alert.alias || ''} ${alert.msg || ''} ${alert.sn || ''}`.toLowerCase();
    
    const prefix = "ANALYSEPERIODE: Systemet har vurdert de siste 14 dagene med historisk data for å kalkulere dette avviket.\n\n";

    if(textBlob.includes('aws') || textBlob.includes('gradient')) 
        return prefix + 'TERMISK SIKKERHET (AWS): Dette er maskinens "febermåler". Den overvåker hvor raskt varmen stiger. Hvis temperaturen øker unormalt fort, slår den ut for å forhindre brann eller permanent skade. Dette krever at du sjekker maskinen med en gang.';
    
    if(textBlob.includes('rcf') || textBlob.includes('anomali')) 
        return prefix + 'KUNSTIG INTELLIGENS (RCF): Datamaskinen har lært seg maskinens normale "rytme". Varselet betyr at den hører eller føler noe uvanlig i mønsteret av varme og risting – ofte lenge før et menneske kan merke at noe er galt.';
    
    if(textBlob.includes('siemens') || textBlob.includes('rms')) 
        return prefix + 'VIBRASJONSMÅLING (MINDSPHERE): Denne sjekker om maskinen rister mer enn den tåler. Det fungerer som en alarm for ubalanse – hvis ristingen vedvarer, er det et tegn på at deler (som kulelagre) begynner å bli slitt og bør byttes.';
    
    if(textBlob.includes('spindel') || textBlob.includes('qss')) 
        return prefix + 'SMART OPPVARMING (SPINDEL): Denne er laget for å forstå forskjellen på en vanlig "kaldstart" om morgenen og et ekte problem. Den vet at maskinen må bli varm, men varsler hvis varmen oppfører seg rart under denne prosessen.';
    
    return prefix + 'HENDELSESANALYSE: Systemet har oppdaget et avvik fra det normale mønsteret. Det betyr at maskinen oppfører seg annerledes nå enn den har gjort de siste to ukene.';
};


const AggregatedAnalyticsView = React.memo(({ alerts }: any) => {
  const [filterMachine, setFilterMachine] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<string | null>(null);

  // Cross-filtered sub-sets
  const filteredForPareto = useMemo(() => {
    if (!alerts) return [];
    return alerts.filter((a: any) => {
        const matchesDate = !filterDate || new Date(a.timestamp).toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit' }) === filterDate;
        const str = `${a.alarm_source || ''} ${a.type || ''} ${a.FINAL_VERDICT || ''} ${a.alias || ''} ${a.msg || ''}`.toLowerCase();
        let matchesSource = true;
        if (filterSource) {
            if (filterSource.includes('AWS')) matchesSource = str.includes('aws') || str.includes('gradient');
            else if (filterSource.includes('RCF')) matchesSource = str.includes('rcf') || str.includes('anomali');
            else if (filterSource.includes('Siemens')) matchesSource = str.includes('siemens') || str.includes('rms');
            else if (filterSource.includes('Spindel')) matchesSource = str.includes('spindel') || str.includes('qss');
            else if (filterSource.includes('Annet')) matchesSource = !str.includes('aws') && !str.includes('rcf') && !str.includes('siemens') && !str.includes('spindel');
        }
        return matchesDate && matchesSource;
    });
  }, [alerts, filterDate, filterSource]);

  const filteredForOther = useMemo(() => {
    if (!alerts) return [];
    return alerts.filter((a: any) => {
        const name = a.alias || a.shortSn.replace(/^api_/i, '');
        const matchesMachine = !filterMachine || name === filterMachine;
        const matchesDate = !filterDate || new Date(a.timestamp).toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit' }) === filterDate;
        
        const str = `${a.alarm_source || ''} ${a.type || ''} ${a.FINAL_VERDICT || ''} ${a.alias || ''} ${a.msg || ''}`.toLowerCase();
        let matchesSource = true;
        if (filterSource) {
            if (filterSource.includes('AWS')) matchesSource = str.includes('aws') || str.includes('gradient');
            else if (filterSource.includes('RCF')) matchesSource = str.includes('rcf') || str.includes('anomali');
            else if (filterSource.includes('Siemens')) matchesSource = str.includes('siemens') || str.includes('rms');
            else if (filterSource.includes('Spindel')) matchesSource = str.includes('spindel') || str.includes('qss');
            else if (filterSource.includes('Annet')) matchesSource = !str.includes('aws') && !str.includes('rcf') && !str.includes('siemens') && !str.includes('spindel');
        }

        return matchesMachine && matchesDate && matchesSource;
    });
  }, [alerts, filterMachine, filterDate, filterSource]);

  // Aggregate data for Pareto (Machine Ranking)
  const paretoData = useMemo(() => {
    if (!filteredForPareto.length) return [];
    const counts: Record<string, number> = {};
    filteredForPareto.forEach((a: any) => {
        const name = a.alias || a.shortSn.replace(/^api_/i, '');
        counts[name] = (counts[name] || 0) + 1;
    });
    const sorted = Object.keys(counts).map(k => ({ name: k, count: counts[k] })).sort((a,b) => b.count - a.count);
    return sorted.slice(0, 7);
  }, [filteredForPareto]);

  // Aggregate data for Pie (Source Distribution)
  const sourceData = useMemo(() => {
    // Only filtered by Machine and Date (to see how many AWS vs RCF for a machine)
    const baseForSource = alerts?.filter((a: any) => {
        const name = a.alias || a.shortSn.replace(/^api_/i, '');
        const matchesMachine = !filterMachine || name === filterMachine;
        const matchesDate = !filterDate || new Date(a.timestamp).toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit' }) === filterDate;
        return matchesMachine && matchesDate;
    }) || [];

    if (!baseForSource.length) return [];
    let aws = 0, rcf = 0, siemens = 0, spindel = 0, other = 0;
    baseForSource.forEach((a: any) => {
        const str = `${a.alarm_source || ''} ${a.type || ''} ${a.FINAL_VERDICT || ''} ${a.alias || ''} ${a.msg || ''}`.toLowerCase();
        if(str.includes('aws') || str.includes('gradient')) aws++;
        else if(str.includes('rcf') || str.includes('anomali')) rcf++;
        else if(str.includes('siemens') || str.includes('rms')) siemens++;
        else if(str.includes('spindel') || str.includes('qss')) spindel++;
        else other++;
    });
    const data = [];
    if(aws>0) data.push({ name: 'AWS (Termisk)', value: aws, color: '#f97316' });
    if(rcf>0) data.push({ name: 'RCF (Nevral)', value: rcf, color: '#a855f7' });
    if(siemens>0) data.push({ name: 'Siemens (Vibrasjon)', value: siemens, color: '#3b82f6' });
    if(spindel>0) data.push({ name: 'Spindel (Kaldstart)', value: spindel, color: '#10b981' });
    if(other>0) data.push({ name: 'Annet', value: other, color: '#64748b' });
    return data;
  }, [alerts, filterMachine, filterDate]);

  // Aggregate data for Timeline
  const timelineData = useMemo(() => {
    // Filtered by Machine and Source
    const baseForTimeline = alerts?.filter((a: any) => {
        const name = a.alias || a.shortSn.replace(/^api_/i, '');
        const matchesMachine = !filterMachine || name === filterMachine;
        const str = `${a.alarm_source || ''} ${a.type || ''} ${a.FINAL_VERDICT || ''} ${a.alias || ''} ${a.msg || ''}`.toLowerCase();
        let matchesSource = true;
        if (filterSource) {
            if (filterSource.includes('AWS')) matchesSource = str.includes('aws') || str.includes('gradient');
            else if (filterSource.includes('RCF')) matchesSource = str.includes('rcf') || str.includes('anomali');
            else if (filterSource.includes('Siemens')) matchesSource = str.includes('siemens') || str.includes('rms');
            else if (filterSource.includes('Spindel')) matchesSource = str.includes('spindel') || str.includes('qss');
            else if (filterSource.includes('Annet')) matchesSource = !str.includes('aws') && !str.includes('rcf') && !str.includes('siemens') && !str.includes('spindel');
        }
        return matchesMachine && matchesSource;
    }) || [];

    if (!baseForTimeline.length) return [];
    const days: Record<string, number> = {};
    const dayTimes: Record<string, number> = {};
    baseForTimeline.forEach((a: any) => {
       const d = new Date(a.timestamp);
       const dateStr = d.toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit' });
       days[dateStr] = (days[dateStr] || 0) + 1;
       if(!dayTimes[dateStr] || d.getTime() < dayTimes[dateStr]) dayTimes[dateStr] = d.getTime();
    });
    return Object.keys(days).map(k => ({ date: k, hendelser: days[k], t: dayTimes[k] })).sort((a,b) => a.t - b.t);
  }, [alerts, filterMachine, filterSource]);

  const resetFilters = () => {
    setFilterMachine(null);
    setFilterDate(null);
    setFilterSource(null);
  };

  if (!alerts || alerts.length === 0) {
      return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 shadow-xl min-h-[750px] gap-4">
        <Activity className="w-16 h-16 opacity-20" />
        <h2 className="text-xl font-medium text-slate-400">Ingen data for flåteanalyse</h2>
      </div>
      );
  }

  const CustomTooltipPie = ({ active, payload }: any) => {
      if (active && payload && payload.length) {
          return (
              <div className="bg-slate-900 border border-slate-700 p-2 rounded-lg shadow-xl font-mono text-xs text-white">
                  <span className="font-bold" style={{color: payload[0].payload.color}}>{payload[0].name}:</span> {payload[0].value} hendelser
              </div>
          );
      }
      return null;
  };

  const CustomTooltipAgg = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl font-mono text-[10px] text-white">
                <p className="text-slate-400 mb-2 font-bold border-b border-slate-800 pb-1 uppercase tracking-widest">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={index} className="flex justify-between gap-4 py-0.5">
                        <span className="text-slate-300">{entry.name}:</span>
                        <span className="font-bold text-blue-400">{entry.value}</span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
  };

  const isFiltered = filterMachine || filterDate || filterSource;

  return (
    <div className="flex flex-col h-full bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-xl min-h-[750px] overflow-hidden">
      {/* HEADER */}
      <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-900 to-transparent relative">
         <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
         <div className="flex flex-col">
            <h2 className="text-2xl font-black text-white tracking-tight uppercase flex items-center gap-3">
                <Activity className="w-6 h-6 text-blue-500" /> Flåteanalyse {isFiltered ? '(Filsentrert)' : '(Global)'}
            </h2>
            <div className="text-slate-400 font-mono text-sm mt-1 flex items-center gap-2">
                Analyserer {filteredForOther.length} av {alerts.length} hendelser 
                {filterMachine && <span className="px-2 py-0.5 bg-blue-900/40 text-blue-400 rounded border border-blue-500/30 text-[10px] ml-2">Maskin: {filterMachine}</span>}
                {filterDate && <span className="px-2 py-0.5 bg-purple-900/40 text-purple-400 rounded border border-purple-500/30 text-[10px] ml-2">Dato: {filterDate}</span>}
                {filterSource && <span className="px-2 py-0.5 bg-orange-900/40 text-orange-400 rounded border border-orange-500/30 text-[10px] ml-2">Kilde: {filterSource}</span>}
            </div>
         </div>
         {isFiltered && (
             <button 
                onClick={resetFilters}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold uppercase tracking-widest text-slate-300 rounded-lg transition-all flex items-center gap-2"
             >
                <CheckSquare className="w-4 h-4" /> Nullstill filter
             </button>
         )}
      </div>

      <div className="flex-1 p-6 space-y-8 overflow-y-auto">
         
         <div className="grid grid-cols-2 gap-8">
            {/* PARETO: WORST OFFENDERS */}
            <div className="col-span-2 xl:col-span-1 bg-black/20 border border-slate-800/50 rounded-xl p-5 flex flex-col transition-all duration-500">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-orange-500" /> {filterDate ? `Problem-maskiner den ${filterDate}` : 'Top 7 Utsatte Maskiner (Pareto)'}
                </h3>
                <div className="flex-1 min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={paretoData} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={false} />
                            <XAxis type="number" stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} />
                            <YAxis type="category" dataKey="name" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 10, width: 120 }} width={120} />
                            <RechartsTooltip cursor={{fill: '#1e293b', opacity: 0.4}} content={<CustomTooltipAgg />} />
                            <Bar 
                                dataKey="count" 
                                name="Antall Alarmer" 
                                radius={[0, 4, 4, 0]} 
                                isAnimationActive={false}
                                onClick={(dataPoint: any) => setFilterMachine(filterMachine === dataPoint.name ? null : dataPoint.name)}
                            >
                                {paretoData.map((entry, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        cursor="pointer"
                                        fill={filterMachine === entry.name ? '#3b82f6' : (filterMachine ? '#1e293b' : '#ef4444')} 
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* SOURCE DISTRIBUTION */}
            <div className="col-span-2 xl:col-span-1 bg-black/20 border border-slate-800/50 rounded-xl p-5 flex flex-col transition-all duration-500">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-purple-500" /> Feilkilde Fordeling {filterMachine ? `(${filterMachine})` : ''}
                </h3>
                <div className="flex-1 min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={sourceData} 
                                cx="50%" 
                                cy="50%" 
                                innerRadius={70} 
                                outerRadius={110} 
                                dataKey="value" 
                                isAnimationActive={false} 
                                stroke="#0f172a" 
                                strokeWidth={2}
                                onClick={(dataPoint: any) => setFilterSource(filterSource === dataPoint.name ? null : dataPoint.name)}
                            >
                                {sourceData.map((entry, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={filterSource === entry.name ? entry.color : (filterSource ? '#1e293b' : entry.color)} 
                                        cursor="pointer"
                                        style={{ outline: filterSource === entry.name ? `2px solid ${entry.color}` : 'none', outlineOffset: '4px' }}
                                    />
                                ))}
                            </Pie>
                            <RechartsTooltip content={<CustomTooltipPie />} />
                            <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* TIMELINE */}
            <div className="col-span-2 bg-black/20 border border-slate-800/50 rounded-xl p-5 flex flex-col transition-all duration-500">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" /> Hendelsesfrekvens {filterMachine ? `for ${filterMachine}` : 'Tidslinje'}
                </h3>
                <div className="flex-1 min-h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="date" stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} />
                            <YAxis stroke="#3b82f6" tick={{ fill: '#3b82f6', fontSize: 10 }} allowDecimals={false} />
                            <RechartsTooltip cursor={{fill: '#1e293b', opacity: 0.4}} content={<CustomTooltipAgg />} />
                            <Bar 
                                dataKey="hendelser" 
                                name="Kritiske Hendelser" 
                                radius={[4, 4, 0, 0]} 
                                isAnimationActive={false}
                                onClick={(dataPoint: any) => setFilterDate(filterDate === dataPoint.date ? null : dataPoint.date)}
                            >
                                {timelineData.map((entry, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        cursor="pointer"
                                        fill={filterDate === entry.date ? '#a855f7' : (filterDate ? '#1e293b' : '#3b82f6')} 
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
         </div>

         {/* DETAILS TABLE */}
         {isFiltered && (
             <div className="col-span-2 bg-black/20 border border-slate-800/50 rounded-xl p-5 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" /> Detaljert Hendelseslogg (Filterert)
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                        <thead>
                            <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-tighter text-[10px]">
                                <th className="pb-3 px-2">Tidspunkt</th>
                                <th className="pb-3 px-2">Maskin</th>
                                <th className="pb-3 px-2">Status</th>
                                <th className="pb-3 px-2">Målte Verdier</th>
                                <th className="pb-3 px-2 text-right">Parameter / Beskrivelse</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredForOther.slice(0, 15).map((a: any, idx: number) => {
                                const d = new Date(a.timestamp);
                                const timeStr = d.toLocaleString('no-NO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                                
                                // Determiner kilde-ikon/markør
                                const isAws = String(a.alarm_source).toLowerCase().includes('aws') || String(a.msg).toLowerCase().includes('gradient');
                                
                                return (
                                    <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                        <td className="py-3 px-2 text-slate-400 text-[10px] whitespace-nowrap">{timeStr}</td>
                                        <td className="py-3 px-2 font-bold text-white whitespace-nowrap text-[11px]">{a.alias || a.shortSn.replace(/^api_/i, '')}</td>
                                        <td className="py-3 px-2">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${getStatusColor(a.FINAL_VERDICT || a.type)}`}>
                                                {translateVerdict(a.FINAL_VERDICT || a.type)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2">
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col">
                                                    <span className="text-orange-400 font-bold text-[11px]">{a.temp_mean ? `${a.temp_mean?.toFixed(1)}°C` : '--'}</span>
                                                    {a.temp_gradient !== undefined && a.temp_gradient !== 0 && (
                                                        <span className="text-purple-400 text-[9px] font-bold">
                                                            {a.temp_gradient > 0 ? '+' : ''}{a.temp_gradient?.toFixed(1)}°C/h
                                                        </span>
                                                    )}
                                                </div>
                                                {a.vib_rms > 0 && (
                                                    <div className="h-6 w-[1px] bg-slate-800 mx-1"></div>
                                                )}
                                                {a.vib_rms > 0 && (
                                                    <span className="text-blue-400 font-bold text-[11px]">{a.vib_rms?.toFixed(2)}g</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-2 text-right text-slate-300 max-w-[400px] truncate group relative text-[11px]">
                                            <span className="hover:text-white transition-colors">{a.msg || a.FINAL_VERDICT || 'Detaljer loggført'}</span>
                                            <div className="hidden group-hover:block absolute right-0 bottom-full mb-2 p-2 bg-slate-900 border border-slate-700 rounded shadow-2xl z-50 text-[10px] w-64 text-left whitespace-normal">
                                                {a.msg || a.FINAL_VERDICT}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filteredForOther.length > 15 && (
                        <div className="mt-4 text-center text-slate-500 text-[10px] uppercase tracking-widest">
                            Viser 15 av {filteredForOther.length} hendelser. Bruk sidepanelet til venstre for fullstendig logg.
                        </div>
                    )}
                </div>
             </div>
         )}

      </div>
    </div>
  );
});


const DetailedAnalysisView = React.memo(({ selectedAlert }: any) => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAlert || !selectedAlert.sn) return;
    let isMounted = true;
    setLoading(true);
    setError(null);
    setChartData([]);

    fetch(`/api/history?sn=${selectedAlert.sn}`)
      .then(res => res.json())
      .then(json => {
        if (!isMounted) return;
        if (json.status === 'error') {
          setError(json.message);
        } else {
          setChartData(json.data || []);
        }
        setLoading(false);
      })
      .catch(err => {
        if (!isMounted) return;
        setError(err.message);
        setLoading(false);
      });
      return () => { isMounted = false; };
  }, [selectedAlert]);

  if (!selectedAlert) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 shadow-xl min-h-[750px] gap-4">
        <Activity className="w-16 h-16 opacity-20" />
        <h2 className="text-xl font-medium text-slate-400">Velg en hendelse fra loggen</h2>
        <p className="text-sm text-slate-500 max-w-sm text-center">Klikk på en alarm i hendelsesloggen til venstre for å se dyptgående historisk analyse og trendkurver for sensoren.</p>
      </div>
    );
  }

  const formatXAxis = (tickItem: any) => {
    try {
      const d = new Date(tickItem);
      return d.toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
    } catch { return String(tickItem); }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl font-mono text-xs">
          <p className="text-slate-300 mb-2 font-bold border-b border-slate-800 pb-1">{formatXAxis(label)}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="flex justify-between gap-4">
              <span>{entry.name}:</span>
              <span className="font-bold">{entry.value} {entry.dataKey === 'temp_mean' ? '°C' : 'g'}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const isoTimestamp = new Date(selectedAlert.timestamp).toISOString();

  // Finne nærmeste punkt i grafen for å markere hendelsen
  const eventMarker = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    const targetTs = new Date(selectedAlert.timestamp).getTime();
    let closest = chartData[0];
    let minDiff = Math.abs(new Date(chartData[0].timestamp).getTime() - targetTs);

    for (const point of chartData) {
        const diff = Math.abs(new Date(point.timestamp).getTime() - targetTs);
        if (diff < minDiff) {
            minDiff = diff;
            closest = point;
        }
    }
    return closest;
  }, [chartData, selectedAlert.timestamp]);

  return (
    <div className="flex flex-col h-full bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-xl min-h-[750px] overflow-hidden">
      <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-gradient-to-r from-slate-900 to-transparent relative">
         <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
         <div>
            <h2 className="text-2xl font-black text-white tracking-tight">{selectedAlert.alias || selectedAlert.shortSn.replace(/^api_/i, '')}</h2>
            <div className="text-slate-400 font-mono text-sm mt-1 mb-4">SN: {selectedAlert.sn}</div>
            
            <div className="bg-slate-800/80 border border-slate-700/80 p-3 rounded-lg max-w-2xl shadow-inner backdrop-blur-sm">
               <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs uppercase font-bold text-slate-500 tracking-widest mb-1">Diagnostikk og Systemkilde</h4>
                    <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                       {getAlarmDescription(selectedAlert)}
                    </p>
                  </div>
               </div>
            </div>
         </div>
         <div className={`px-4 py-2 rounded-lg font-bold tracking-widest text-sm uppercase ${
            String(selectedAlert.type).includes('FIRE') || String(selectedAlert.type).includes('CRITICAL') || String(selectedAlert.FINAL_VERDICT).includes('POŻAR') || String(selectedAlert.FINAL_VERDICT).includes('KRITISK')
            ? 'bg-red-950/50 text-red-400 border border-red-900/50' 
            : 'bg-yellow-950/50 text-yellow-400 border border-yellow-900/50'
         }`}>
            {translateVerdict(selectedAlert.FINAL_VERDICT || selectedAlert.type)}
         </div>
      </div>

      <div className="grid grid-cols-3 gap-6 p-6 border-b border-slate-800/50 bg-black/20">
         <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Tidspunkt for Hendelse</span>
            <span className="text-white font-mono">{formatTime(selectedAlert.timestamp)}</span>
         </div>
         <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Temperatur ved Hendelse</span>
            <span className="text-orange-400 flex items-center gap-2 font-mono"><Thermometer className="w-4 h-4"/> {selectedAlert.temp_mean?.toFixed(1) || '--'}°C</span>
         </div>
         <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Vibrasjon ved Hendelse</span>
            <span className="text-blue-400 flex items-center gap-2 font-mono"><Activity className="w-4 h-4"/> {selectedAlert.vib_rms?.toFixed(2) || '--'}g</span>
         </div>
      </div>

      <div className="flex-1 p-6 relative flex flex-col">
         <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-3">
            <TrendingUp className="w-4 h-4 text-blue-500" /> Historisk Trendanalyse (14 dager)
         </h3>
         
         {loading ? (
             <div className="absolute inset-0 flex items-center justify-center z-10">
                 <div className="flex flex-col items-center gap-4 text-blue-500">
                     <Activity className="w-12 h-12 animate-spin" />
                     <span className="text-xs font-mono uppercase tracking-widest font-bold">Laster inn massedata...</span>
                 </div>
             </div>
         ) : error ? (
             <div className="absolute inset-0 flex items-center justify-center text-red-400 font-mono text-sm z-10">
                 Feil ved henting av data: {error}
             </div>
         ) : chartData.length > 0 ? (
             <div className="flex-1 w-full min-h-[400px]">
                 <ResponsiveContainer width="100%" height="100%">
                     <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                         <defs>
                             <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                                 <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                             </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                         <XAxis 
                             dataKey="timestamp" 
                             tickFormatter={formatXAxis} 
                             stroke="#475569" 
                             tick={{ fill: '#64748b', fontSize: 10 }} 
                             minTickGap={50}
                         />
                         <YAxis 
                             yAxisId="left" 
                             stroke="#f97316" 
                             tick={{ fill: '#f97316', fontSize: 10 }}
                             domain={['auto', 'auto']}
                         />
                         <YAxis 
                             yAxisId="right" 
                             orientation="right" 
                             stroke="#3b82f6" 
                             tick={{ fill: '#3b82f6', fontSize: 10 }}
                             domain={[0, 'auto']}
                         />
                         <RechartsTooltip content={<CustomTooltip />} />
                         <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }} />
                         
                         {eventMarker && (
                             <ReferenceLine 
                                 x={eventMarker.timestamp} 
                                 stroke="#ef4444" 
                                 strokeWidth={3}
                                 strokeDasharray="5 5"
                                 yAxisId="left"
                                 label={{ 
                                     value: 'HENDELSE', 
                                     position: 'top', 
                                     fill: '#ef4444', 
                                     fontSize: 12, 
                                     fontWeight: 'black'
                                 }} 
                             />
                         )}

                         {eventMarker && eventMarker.temp_mean && (
                             <ReferenceDot 
                                 x={eventMarker.timestamp} 
                                 y={eventMarker.temp_mean} 
                                 yAxisId="left"
                                 r={6} 
                                 fill="#ef4444" 
                                 stroke="#fff" 
                                 strokeWidth={2}
                             />
                         )}
                         
                         <Area 
                             yAxisId="left" 
                             type="stepAfter" 
                             dataKey="temp_mean" 
                             name="Tenperatur" 
                             stroke="#f97316" 
                             strokeWidth={2}
                             fillOpacity={1} 
                             fill="url(#colorTemp)" 
                             isAnimationActive={false}
                         />
                         <Line 
                             yAxisId="right" 
                             type="stepAfter" 
                             dataKey="vib_rms" 
                             name="Vibrasjon (RMS)" 
                             stroke="#3b82f6" 
                             strokeWidth={1.5}
                             dot={false}
                             isAnimationActive={false}
                         />
                     </ComposedChart>
                 </ResponsiveContainer>
             </div>
         ) : (
             <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-mono text-sm z-10">
                 Ingen datapunkt funnet for denne perioden.
             </div>
         )}
      </div>
    </div>
  );
});


const AlertLogSection = React.memo(({ alerts, selectedGroup, onSelectAlert, selectedAlertId, timeFilter, setTimeFilter, onlyCritical, setOnlyCritical }: any) => {
  const filteredAlertsByGroup = useMemo(() => {
    return alerts?.filter((a: any) => a.groupId === selectedGroup) || [];
  }, [alerts, selectedGroup]); // Track alerts length for updates

  return (
    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 shadow-2xl flex flex-col h-[750px] relative overflow-hidden">
      {/* Decorative top glow */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-500/30 to-transparent"></div>

      <div className="flex flex-col gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-3">
            <Activity className="w-4 h-4 text-blue-400" /> Teknisk Hendelseslogg
          </h3>
          <button
            onClick={() => setOnlyCritical(!onlyCritical)}
            className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded transition-all ${onlyCritical ? 'bg-red-900/40 text-red-400 border border-red-500/30' : 'bg-slate-800/50 text-slate-500 border border-transparent hover:text-slate-300'}`}
            title="Pokaż tylko krytyczne alarmy"
          >
            <ShieldAlert className="w-3 h-3" />
            Kun Kritisk
          </button>
        </div>

        {/* TIME FILTERS */}
        <div className="flex gap-1 p-1 bg-black/40 rounded-lg border border-white/5">
          {['24h', '7d', '30d', '90d'].map((f) => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              className={`flex-1 py-1 text-[10px] font-bold uppercase tracking-tighter rounded transition-all ${timeFilter === f ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
            >
              {f === '90d' ? 'Alt' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 mt-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-700/80">
        {filteredAlertsByGroup.length > 0 ? (
          filteredAlertsByGroup.map((alert: any, i: number) => {
            const isFire = String(alert?.FINAL_VERDICT || '').includes('POŻAR') || String(alert?.FINAL_VERDICT || '').includes('KRITISK');
            return (
              <div key={i} onClick={() => onSelectAlert && onSelectAlert(alert)} className={`p-4 rounded-xl border flex flex-col gap-2 relative overflow-hidden transition-all duration-300 hover:translate-x-1 cursor-pointer ${selectedAlertId === alert.id ? 'ring-2 ring-blue-500 bg-slate-800/80 shadow-[0_0_20px_rgba(59,130,246,0.3)] ' : ''}${isFire ? 'bg-red-950/30 border-red-900/50 shadow-[0_0_15px_rgba(220,38,38,0.1)]' : 'bg-yellow-950/20 border-yellow-900/30 shadow-[0_0_10px_rgba(202,138,4,0.05)]'}`}>
                {isFire && <div className="absolute top-0 left-0 w-1 h-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,1)]"></div>}
                {!isFire && <div className="absolute top-0 left-0 w-1 h-full bg-yellow-600"></div>}

                <div className="flex justify-between items-start gap-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider leading-tight break-words border ${isFire ? 'bg-red-900/50 text-red-100 border-red-500/30' : 'bg-yellow-900/50 text-yellow-100 border-yellow-500/30'}`}>
                    {alert.alias || alert.shortSn.replace(/^api_/i, '')}
                  </span>
                  <div className="flex flex-col items-end gap-0.5 mt-0.5">
                    <span className="text-[11px] text-slate-500 font-mono shrink-0 leading-none">
                      {formatTime(alert.timestamp)}
                    </span>
                    <span className="text-[9px] text-slate-500/70 font-mono italic leading-none whitespace-nowrap">
                      {getRelativeTime(alert.timestamp)}
                    </span>
                    {alert.received_timestamp && getReactionTime(alert.timestamp, alert.received_timestamp) && (
                      <span className="text-[9px] text-blue-400 font-mono italic leading-none whitespace-nowrap mt-0.5" title="Czas przetwarzania od sensorów AI do dashboardu">
                        {getReactionTime(alert.timestamp, alert.received_timestamp)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`text-sm font-black tracking-wide ${isFire ? 'text-red-400' : 'text-yellow-400'}`}>
                    {translateVerdict(alert.FINAL_VERDICT || alert.type)}
                  </div>
                  {alert.msg && (
                    <span className="text-[10px] font-mono font-bold text-blue-300 bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-500/30 tracking-widest uppercase shadow-sm">
                      {alert.msg.replace('AI-hendelse detektert', '').replace(/[() \t]/g, '') || alert.msg}
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono text-slate-400 flex flex-wrap gap-x-5 gap-y-1 mt-1 bg-black/20 p-2 rounded-lg border border-white/5">
                  <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-blue-500/70" /> {alert.vib_rms?.toFixed(2) || '0.00'}g</span>
                  <span className="flex items-center gap-1.5"><Thermometer className="w-3.5 h-3.5 text-orange-500/70" /> {alert.temp_mean?.toFixed(1) || '0.0'}°C</span>
                  {alert.temp_gradient !== undefined && (
                    <span className="flex items-center gap-1.5 text-red-400/80">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {alert.temp_gradient > 0 ? '+' : ''}{alert.temp_gradient.toFixed(1)}°C/h
                    </span>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3 text-center px-4">
            <CheckSquare className="w-8 h-8 opacity-20" />
            <span className="text-sm font-medium">Ingen hendelser i valgt periode ({timeFilter}).</span>
          </div>
        )}
      </div>
    </div>
  );
});

export default function Dashboard() {
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedSensor, setSelectedSensor] = useState('');
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [timeFilter, setTimeFilter] = useState('24h');
  const [onlyCritical, setOnlyCritical] = useState(false);



  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [data, setData] = useState<any>({ groups: {}, alerts: [], mining_progress: 100 });

  const filteredAlerts = useMemo(() => {
    let base = data.alerts || [];
    const now = Date.now();

    if (timeFilter === '24h') {
      const dayAgo = now - 24 * 60 * 60 * 1000 - (10 * 60 * 1000);
      base = base.filter((a: any) => a.timestamp >= dayAgo);
    } else if (timeFilter === '7d') {
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000 - (10 * 60 * 1000);
      base = base.filter((a: any) => a.timestamp >= weekAgo);
    } else if (timeFilter === '30d') {
      const monthAgo = now - 30 * 24 * 60 * 60 * 1000 - (10 * 60 * 1000);
      base = base.filter((a: any) => a.timestamp >= monthAgo);
    }

    if (onlyCritical) {
      base = base.filter((a: any) => {
        const verdict = String(a?.FINAL_VERDICT || a?.type || '').toUpperCase();
        return verdict.includes('POŻAR') || verdict.includes('KRITISK') || verdict.includes('BRANN') || verdict.includes('STOPP') || verdict.includes('FIRE') || verdict.includes('CRITICAL');
      });
    }
    return base;
  }, [data.alerts, timeFilter, onlyCritical]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- HMI / SCADA Critical Alert State ---
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());
  const [activeCriticalAlert, setActiveCriticalAlert] = useState<any | null>(null);

  // --- API State ---
  const [apiPanelOpen, setApiPanelOpen] = useState(false);
  const [apiKey, setApiKey] = useState('jP4UeJ8RBN5sX5FdTtKLlHDEEc9nbYlUz/s8UyikfiI=');
  const [systemId, setSystemId] = useState('nIwosVxCrK9RTctvb90X');
  const [apiStep, setApiStep] = useState(1); // 1 = Creds, 2 = Select, 3 = Fetching
  const [availableSensors, setAvailableSensors] = useState<any[]>([]);
  const [selectedApiSensors, setSelectedApiSensors] = useState<Record<string, boolean>>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [useHallCompensation, setUseHallCompensation] = useState(true);
  const [isCompensating, setIsCompensating] = useState(false); // For visual feedback during re-mine

  // --- Loading State ---
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Etablerer sikker tilkobling...');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (apiStep === 3 || uploading) {
      setLoadingProgress(0);
      setLoadingText('Etablerer sikker tilkobling...');
      interval = setInterval(() => {
        setLoadingProgress((prev) => {
          const newProg = prev >= 95 ? 95 : prev + Math.floor(Math.random() * 5) + 1;
          if (newProg > 15 && newProg <= 40) setLoadingText('Henter historiske driftsdata...');
          else if (newProg > 40 && newProg <= 65) setLoadingText('Forbereder datasett for analyse...');
          else if (newProg > 65 && newProg <= 85) setLoadingText('Validerer dataintegritet...');
          else if (newProg > 85) setLoadingText('Kjører nevrale nettverk og mønstergjenkjenning...');
          return newProg;
        });
      }, 400); // update every 400ms
    }
    return () => clearInterval(interval);
  }, [apiStep, uploading]);

  // Default dates: last 7 days
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 16));
  const [apiError, setApiError] = useState('');

  // ---------- ZMIANA: LIVE INGESTION ----------
  const fetchLiveData = () => {
    fetch('/api/live', { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error('Serwer Live nie odpowiada');
        return res.json();
      })
      .then(json => {
        if (json.status === 'ok') {
          React.startTransition(() => {
            const liveSensors: Record<string, any> = {};
            if (json.data && json.data.sensors) {
              json.data.sensors.forEach((s: any) => {
                liveSensors[s.sn] = Object.assign({}, s, {
                  FINAL_VERDICT: s.status,
                  temp_mean: s.temp,
                  alias: s.alias
                });
              });
            }

            const historyEvents = (json.data && json.data.events) ? json.data.events.map((e: any) => ({
              id: `${e.sn}-${e.timestamp}`,
              sn: e.sn,
              shortSn: e.sn,
              alias: e.alias,
              groupId: 'Live Stream (Daemona)',
              type: e.type.includes('BRANN') ? 'FIRE' : (e.type.includes('KRITISK') ? 'CRITICAL' : 'SERVICE'),
              msg: e.msg,
              timestamp: new Date(e.timestamp).getTime(),
              received_timestamp: e.received_timestamp ? new Date(e.received_timestamp).getTime() : null,
              vib_rms: e.vib_rms,
              temp_mean: e.temp_mean,
              temp_gradient: e.temp_gradient
            })) : [];

            setData({
              groups: {
                'Live Stream (Daemona)': {
                  aggregateState: 'MONITORING',
                  sensors: liveSensors
                }
              },
              alerts: historyEvents
            });

            // --- HMI Modal Logic ---
            // Znajdź najnowszy (pierwszy z góry) alarm Krytyczny lub Pożar z ostatnich 10 minut
            const recentCriticals = historyEvents.filter((e: any) =>
              (e.type === 'FIRE' || e.type === 'CRITICAL' || String(e.FINAL_VERDICT).includes('POŻAR')) &&
              (Date.now() - e.timestamp < 10 * 60 * 1000) // Tylko świeże (ostatnie 10 minut)
            );

            if (recentCriticals.length > 0) {
              const latest = recentCriticals[0];
              // Jeśli operator jeszcze nie zatwierdził dokładnie tego alarmu (po ID/czasie)
              if (!acknowledgedAlerts.has(latest.id)) {
                setActiveCriticalAlert(latest);
              }
            }

            setSelectedGroup('Live Stream (Daemona)');
            setError(null);
          });
        }
        setLoading(false);
      })
      .catch(err => {
        console.warn("Live API Error:", err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    // Pierwszy strzał
    fetchLiveData();

    // Pobierz ustawienia demona
    fetch('/api/settings').then(r => r.json()).then(settings => {
      setUseHallCompensation(settings.use_hall_compensation ?? true);
    });

    // Polling co 15 sekund dla systemu Real-Time Streaming (zsynchronizowane z API)
    const liveInterval = setInterval(fetchLiveData, 15000);

    // Load saved API credentials
    const savedKey = localStorage.getItem('api_key');
    const savedSysId = localStorage.getItem('system_id');
    if (savedKey) setApiKey(savedKey);
    if (savedSysId) setSystemId(savedSysId);

    return () => clearInterval(liveInterval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // --------------------------------------------



  const toggleCompensation = async () => {
    const newValue = !useHallCompensation;
    setUseHallCompensation(newValue);
    setIsCompensating(true);

    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ use_hall_compensation: newValue })
      });

      // Powiadomienie wizualne że daemon przelicza (zwykle trwa to kilka sekund zanim się odświeży)
      setTimeout(() => {
        fetchLiveData();
        setTimeout(() => setIsCompensating(false), 2000);
      }, 3000);
    } catch (err) {
      console.error("Failed to toggle compensation", err);
      setIsCompensating(false);
    }
  };


  const { groups, alerts } = data;
  const currentGroupData = groups?.[selectedGroup];
  const groupSensorsMap = currentGroupData?.sensors || {};
  const groupSensorKeys = Object.keys(groupSensorsMap);
  const strGroupVerdict = String(currentGroupData?.aggregateState || 'INAKTIV');

  // Liczniki do kafelków bocznych
  const totalSensors = groupSensorKeys.length;
  const criticalCount = groupSensorKeys.filter(sn => String(groupSensorsMap[sn]?.FINAL_VERDICT || '').includes('POŻAR') || String(groupSensorsMap[sn]?.FINAL_VERDICT || '').includes('KRITISK')).length;
  const warningCount = groupSensorKeys.filter(sn => String(groupSensorsMap[sn]?.FINAL_VERDICT || '').includes('SERWIS')).length;
  const healthyCount = totalSensors - criticalCount - warningCount;


  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center flex-col gap-4">
        <div className="text-xl text-red-500 font-semibold">Kritisk feil: {error}</div>
        <button onClick={() => fetchLiveData()} className="px-4 py-2 bg-blue-600 rounded text-white">Prøv på nytt</button>
      </div>
    );
  }


  const handleAcknowledge = () => {
    if (activeCriticalAlert) {
      setAcknowledgedAlerts(prev => new Set(prev).add(activeCriticalAlert.id));
      setActiveCriticalAlert(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-6 font-sans">

      {/* 🔴🔥 HMI SCADA CRITICAL MODAL 🔥🔴 */}
      {activeCriticalAlert && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-red-950/90 backdrop-blur-md">
          {/* Intensive flashing background */}
          <div className="absolute inset-0 bg-red-600/20 mix-blend-overlay animate-pulse pointer-events-none" style={{ animationDuration: '0.5s' }}></div>

          <div className="bg-slate-900 border-2 border-red-500 rounded-3xl p-10 max-w-2xl w-full mx-4 shadow-[0_0_100px_rgba(220,38,38,0.6)] relative z-10 flex flex-col items-center text-center transform transition-all scale-100">

            <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-6 border border-red-500/50 shadow-[0_0_30px_rgba(220,38,38,0.8)]">
              <ShieldAlert className="w-12 h-12 text-red-500 animate-[bounce_1s_infinite]" />
            </div>

            <h2 className="text-4xl font-black text-white mb-2 tracking-tight uppercase">
              {translateVerdict(activeCriticalAlert.type || activeCriticalAlert.FINAL_VERDICT)}
            </h2>

            <div className="text-red-400 font-bold text-xl uppercase tracking-widest mb-8">
              Maskin: {activeCriticalAlert.alias || activeCriticalAlert.shortSn || activeCriticalAlert.sn}
            </div>

            <div className="grid grid-cols-2 gap-4 w-full mb-8 font-mono">
              <div className="bg-black/50 border border-slate-700 rounded-xl p-4 flex flex-col items-center">
                <span className="text-slate-500 text-xs uppercase tracking-widest mb-1">Tidspunkt</span>
                <span className="text-white text-lg">{formatTime(activeCriticalAlert.timestamp)}</span>
              </div>
              <div className="bg-black/50 border border-slate-700/50 rounded-xl p-4 flex flex-col items-center">
                <span className="text-slate-500 text-xs uppercase tracking-widest mb-1">Status</span>
                <span className="text-red-400 text-lg font-bold">AKSJON KREVES</span>
              </div>
            </div>

            <p className="text-slate-300 text-base mb-10 max-w-md">
              Maskinen har nådd kritiske grenseverdier for temperatur eller vibrasjon. Inspiser maskinen umiddelbart for å forhindre havari eller brann.
            </p>

            <button
              onClick={handleAcknowledge}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-black text-xl py-6 rounded-xl uppercase tracking-[0.2em] transition-all active:scale-95 shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:shadow-[0_0_30px_rgba(220,38,38,0.6)] flex items-center justify-center gap-3"
            >
              <CheckSquare className="w-6 h-6" />
              BEKREFT ALARM (ACKNOWLEDGE)
            </button>
          </div>
        </div>
      )}

      {(uploading || (apiStep === 3 && apiPanelOpen)) && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/50 p-8 rounded-2xl flex flex-col items-center w-full max-w-md shadow-2xl relative overflow-hidden">
            {/* Pulsing background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-blue-500/10 blur-[50px] rounded-full pointer-events-none" />

            <Activity className="w-16 h-16 text-blue-500 animate-[bounce_2s_infinite] mb-6 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />

            <div className="text-white text-2xl font-light mb-2">Analyserer Maskingruppe med AI</div>

            {/* Dynamic Status Text */}
            <div className="h-6 flex items-center justify-center mb-6">
              <div className="text-blue-400 text-sm font-medium animate-pulse">{loadingText}</div>
            </div>

            {/* Progress Bar Container */}
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2 relative">
              <div
                className="h-full bg-gradient-to-r from-blue-600 via-blue-400 to-blue-600 rounded-full transition-all duration-300 ease-out flex items-center justify-end pr-1 shadow-[0_0_10px_rgba(59,130,246,0.6)]"
                style={{ width: `${loadingProgress}%` }}
              >
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
              </div>
            </div>

            {/* Progress Percentage */}
            <div className="w-full flex justify-between text-[10px] text-slate-500 font-mono italic px-1">
              <span>INITIALISERER...</span>
              <span className="text-blue-400 font-bold">{loadingProgress}%</span>
            </div>
          </div>
        </div>
      )}

      {/* HEADER & IMPORT WIDGETS */}
      <header className="flex flex-col xl:flex-row items-start xl:items-stretch justify-between pb-6 border-b border-slate-800 mb-6 gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-8 h-8 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Saglinje Kirkenes</h1>
              <p className="text-sm text-slate-400">AI Prediktiv Analyse · <span className="text-blue-400">productionpulse.no</span></p>
            </div>
          </div>

          {/* Pokaż selektor grup tylko gdy jest więcej niż 1 batch */}
          {Object.keys(groups).length > 1 && (
            <div className="mt-8">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Velg Maskingruppe (Batch)</div>
              <div className="flex gap-2 flex-wrap min-h-[40px]">
                {(data.orderedGroups || Object.keys(groups)).map((g: string) => (
                  <button
                    key={g}
                    onClick={() => { setSelectedGroup(g); }}
                    className={`px-4 py-2 rounded-md font-bold text-sm transition-all ${selectedGroup === g
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                  >
                    {g === 'Standard' ? 'Eldre Data' : g.replace('API_', 'API: ').replace('BATCH_', 'BATCH: ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex">
              <button
                 onClick={() => setSelectedAlert(null)}
                 className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all ${!selectedAlert ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'}`}
              >
                 <Activity className="w-4 h-4" /> Flåteanalyse
              </button>
          </div>
        </div>

        {/* RIGHT WIDGETS */}
        <div className="w-full xl:w-[550px] flex gap-4">
          <button
            onClick={toggleCompensation}
            className={`flex-1 bg-slate-900/60 backdrop-blur-xl border ${useHallCompensation ? 'border-blue-500/50' : 'border-slate-700/50'} rounded-2xl p-5 flex items-center justify-between transition-all hover:bg-slate-800/80 group overflow-hidden relative`}
          >
            {isCompensating && (
              <div className="absolute inset-0 bg-blue-600/10 animate-pulse pointer-events-none" />
            )}
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner transition-colors ${useHallCompensation ? 'bg-blue-500/20 border-blue-400/30' : 'bg-slate-800 border-slate-700'}`}>
                {data.mining_progress < 100 ? (
                  <Activity className="w-6 h-6 text-blue-400 animate-spin" />
                ) : (
                  <Thermometer className={`w-6 h-6 ${useHallCompensation ? 'text-blue-400' : 'text-slate-500'}`} />
                )}
              </div>
              <div className="text-left">
                <h3 className="font-bold text-white text-sm leading-tight">Romtemperatur-kompensasjon</h3>
                {data.mining_progress < 100 ? (
                  <div className="mt-2 w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${data.mining_progress}%` }}
                    />
                    <p className="text-[8px] text-blue-400 mt-1 font-mono uppercase">Beregner historikk... {data.mining_progress}%</p>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-mono">
                    {useHallCompensation ? 'AKTIV (Sensor 30001856)' : 'DEAKTIVERT - Rå gradient'}
                  </p>
                )}
              </div>
            </div>
            {useHallCompensation ? (
              <ToggleRight className="w-8 h-8 text-blue-500" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-slate-700" />
            )}
          </button>

          <div className="flex-1 bg-gradient-to-br from-blue-900/40 to-slate-900/90 backdrop-blur-xl border border-blue-700/50 border-t-blue-500/50 rounded-2xl overflow-hidden shadow-lg shadow-blue-500/10 p-5 flex items-center justify-between min-w-[200px]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shadow-inner">
                <Activity className="w-6 h-6 text-blue-400 animate-pulse drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-white text-lg leading-tight drop-shadow-md">Live Stream Aktiv</h3>
                <p className="text-xs text-blue-200/70 mt-1 font-mono uppercase tracking-widest">Polling hver 2. minutt fra Daemon</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* DASHBOARD CONTENT - SCADA LAYOUT */}
      {currentGroupData && (
        <div className="flex flex-col gap-6 mb-8 max-w-[1920px] mx-auto">

          {/* TOP KPI BAR */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900/40 backdrop-blur-md border border-slate-700/50 p-4 rounded-2xl shadow-xl">
            {/* AGGREGATE STATUS */}
            <div className={`col-span-1 md:col-span-2 rounded-xl border p-5 flex items-center justify-between transition-colors duration-500 ${getStatusColor(strGroupVerdict)} relative overflow-hidden backdrop-blur-xl bg-opacity-80`}>
              <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-white/5 to-transparent pointer-events-none"></div>

              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-70 mb-1 z-10">Anleggsstatus</span>
                <div className="text-3xl lg:text-4xl font-black tracking-tight drop-shadow-md flex items-center gap-3 z-10">
                  {strGroupVerdict.includes('BRANN') || strGroupVerdict.includes('POŻAR') || strGroupVerdict.includes('KRITISK') || strGroupVerdict.includes('KRYTYCZNA') ? <AlertTriangle className="w-8 h-8 animate-pulse drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" /> : null}
                  {translateVerdict(strGroupVerdict)}
                </div>
              </div>
            </div>

            {/* SENSOR COUNTERS */}
            <div className="col-span-1 md:col-span-2 grid grid-cols-3 gap-3">
              <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 flex flex-col items-center justify-center relative shadow-inner">
                <span className="text-3xl font-light text-white font-mono">{totalSensors}</span>
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mt-1">Totalt Maskiner</span>
              </div>
              <div className="bg-green-950/20 border border-green-900/30 rounded-xl p-3 flex flex-col items-center justify-center relative shadow-inner">
                <span className="text-3xl font-light text-green-400 font-mono">{healthyCount}</span>
                <span className="text-[9px] uppercase font-bold text-green-600 tracking-widest mt-1">Frisk</span>
              </div>
              <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3 flex flex-col items-center justify-center relative shadow-inner">
                <span className="text-3xl font-light text-red-400 font-mono drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]">{criticalCount}</span>
                <span className="text-[9px] uppercase font-bold text-red-600 tracking-widest mt-1">Kritisk</span>
              </div>
            </div>
          </div>

          {/* MAIN 2-COLUMN CONTENT */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">

            {/* ALERT LOG (LEFT - 1 COL) */}
            <div className="xl:col-span-1 flex flex-col h-full relative z-10 w-full min-h-[750px]">
              <AlertLogSection
                alerts={filteredAlerts}
                selectedGroup={selectedGroup}
                onSelectAlert={setSelectedAlert}
                selectedAlertId={selectedAlert?.id}
                timeFilter={timeFilter}
                setTimeFilter={setTimeFilter}
                onlyCritical={onlyCritical}
                setOnlyCritical={setOnlyCritical}
              />
            </div>

            {/* CHART/ANALYTICS VIEW (RIGHT - 3 COLS) */}
            <div className="xl:col-span-3 h-full relative z-10">
                {selectedAlert ? (
                    <DetailedAnalysisView selectedAlert={selectedAlert} />
                ) : (
                    <AggregatedAnalyticsView alerts={filteredAlerts} />
                )}
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
