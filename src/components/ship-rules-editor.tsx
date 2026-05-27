"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ShipRule } from "@/server/db/schema"

interface ShipRulesEditorProps {
  rules: ShipRule[]
  onChange: (rules: ShipRule[]) => void
}

export function ShipRulesEditor({ rules, onChange }: ShipRulesEditorProps) {
  const updateRule = (index: number, field: keyof ShipRule, value: number) => {
    const next = [...rules]
    next[index] = { ...next[index]!, [field]: value }
    onChange(next)
  }

  const addRule = () => onChange([...rules, { length: 2, count: 1 }])
  const removeRule = (index: number) =>
    onChange(rules.filter((_, i) => i !== index))

  return (
    <div className="space-y-3">
      <div>
        <Label>Ship rules</Label>
        <p className="text-sm text-muted-foreground">
          Define how many ships of each length teams must place on the grid.
        </p>
      </div>
      {rules.map((rule, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={1}
            max={10}
            className="w-20"
            value={rule.length}
            onChange={(e) => updateRule(i, "length", parseInt(e.target.value) || 1)}
          />
          <span className="text-sm text-muted-foreground">tiles ×</span>
          <Input
            type="number"
            min={1}
            max={10}
            className="w-20"
            value={rule.count}
            onChange={(e) => updateRule(i, "count", parseInt(e.target.value) || 1)}
          />
          <span className="text-sm text-muted-foreground">ships</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => removeRule(i)}
            disabled={rules.length <= 1}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRule}>
        Add ship type
      </Button>
    </div>
  )
}
