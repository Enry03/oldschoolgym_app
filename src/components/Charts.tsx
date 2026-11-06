import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface Point {
  x: string
  y: number
}

const GOLD = '#F5C518'
const BLUE = '#2B5BA8'

function Tip({ active, payload, label, unit }: { active?: boolean; payload?: { value: number }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-night px-3 py-2 text-xs shadow-xl">
      <div className="text-muted">{label}</div>
      <div className="font-display text-lg text-cream">
        {payload[0].value}
        {unit ? ` ${unit}` : ''}
      </div>
    </div>
  )
}

export default function Charts({ kind, data, unit, height = 200, color = GOLD }: { kind: 'area' | 'line' | 'bar'; data: Point[]; unit?: string; height?: number; color?: string }) {
  if (!data.length) return <p className="py-10 text-center text-sm text-muted">Ancora nessun dato.</p>
  const axis = { stroke: '#94A0B4', fontSize: 11, tickLine: false, axisLine: false }
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {kind === 'bar' ? (
          <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="x" {...axis} />
            <YAxis {...axis} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<Tip unit={unit} />} />
            <Bar dataKey="y" fill={color} radius={[8, 8, 2, 2]} animationDuration={900} />
          </BarChart>
        ) : kind === 'line' ? (
          <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="x" {...axis} />
            <YAxis {...axis} domain={['auto', 'auto']} />
            <Tooltip content={<Tip unit={unit} />} />
            <Line type="monotone" dataKey="y" stroke={color} strokeWidth={3} dot={{ r: 4, fill: '#060E1C', stroke: color, strokeWidth: 2 }} activeDot={{ r: 6 }} animationDuration={1100} />
          </LineChart>
        ) : (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="g-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="x" {...axis} />
            <YAxis {...axis} domain={['auto', 'auto']} />
            <Tooltip content={<Tip unit={unit} />} />
            <Area type="monotone" dataKey="y" stroke={color} strokeWidth={3} fill="url(#g-area)" animationDuration={1100} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
