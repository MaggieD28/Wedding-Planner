"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface Props {
  accepted: number
  declined: number
  pending: number
}

const COLORS = {
  Accepted: "#B0C4B1",
  Declined: "#C0736A",
  Pending:  "#BFCABA",
}

export default function RsvpChart({ accepted, declined, pending }: Props) {
  const data = [
    { name: "Accepted", value: accepted },
    { name: "Declined", value: declined },
    { name: "Pending",  value: pending },
  ].filter(d => d.value > 0)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name as keyof typeof COLORS]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [`${value} guests`]}
          contentStyle={{
            backgroundColor: "#F7E1D7",
            border: "1px solid #BFCABA",
            borderRadius: "8px",
            fontSize: "13px",
            color: "#4A5759",
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span style={{ color: "#4A5759", fontSize: "13px" }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
