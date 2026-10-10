"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

import { useToast } from "@/components/ui-custom/use-toast"
import { Button } from "@/components/ui/button"

export function CopyButton({
  value,
  label = "복사",
  toastMessage = "복사했습니다.",
  testId,
  size = "sm",
  variant = "outline",
}: {
  value: string
  label?: string
  toastMessage?: string
  testId?: string
  size?: "sm" | "default" | "xs"
  variant?: "outline" | "default" | "ghost"
}) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // 비보안 컨텍스트(http LAN 등): 임시 textarea 로 대체
      const ta = document.createElement("textarea")
      ta.value = value
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      ta.remove()
    }
    setCopied(true)
    toast.success(toastMessage)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Button type="button" size={size} variant={variant} onClick={() => void copy()} data-testid={testId}>
      {copied ? <Check /> : <Copy />}
      {label}
    </Button>
  )
}
