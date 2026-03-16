"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

interface BudgetRow {
  category: string
  budgeted: number
  paid: number
}

interface Props {
  data: BudgetRow[]
}

export default function BudgetChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
        <XAxis
          dataKey="category"
          tick={{ fontSize: 11, fill: "#6B7E80" }}
          angle={-35}
          textAnchor="end"
          interval={0}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6B7E80" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(value, name) => [
            `€${Number(value).toLocaleString()}`,
            name === "budgeted" ? "Budgeted" : "Paid",
          ]}
          contentStyle={{
            backgroundColor: "#F7E1D7",
            border: "1px solid #BFCABA",
            borderRadius: "8px",
            fontSize: "13px",
            color: "#4A5759",
          }}
        />
        <Bar dataKey="budgeted" fill="#BFCABA" radius={[3, 3, 0, 0]} />
        <Bar dataKey="paid" fill="#B0C4B1" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
