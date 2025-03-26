"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { verifyTileWithWom } from "@/app/actions/wom-integration"
import type { Tile } from "@/app/actions/events"
import type { WomVerificationConfig } from "@/types/wom-types"

interface WomAutoVerifyButtonProps {
  tile: Tile
  teamId: string
  eventId: string
  runescapeName?: string | null
  onVerified: () => void
}

export function WomAutoVerifyButton({ tile, teamId, eventId, runescapeName, onVerified }: WomAutoVerifyButtonProps) {
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  // Check if the tile has WOM verification config
  const verificationConfig = tile.womVerificationConfig as WomVerificationConfig | undefined
  const canAutoVerify = verificationConfig?.enabled && runescapeName

  const handleVerify = async () => {
    if (!canAutoVerify || !runescapeName) return

    setIsVerifying(true)
    setVerificationResult(null)

    try {
      const result = await verifyTileWithWom(tile.id, teamId, eventId, runescapeName)

      setVerificationResult({
        success: result.success,
        message: result.success ? "Tile verified successfully!" : result.error || "Failed to verify tile",
      })

      if (result.success) {
        onVerified()
      }
    } catch (error) {
      setVerificationResult({
        success: false,
        message: "An unexpected error occurred",
      })
      console.error(error)
    } finally {
      setIsVerifying(false)
    }
  }

  if (!canAutoVerify) {
    return null
  }

  return (
    <div className="space-y-3">
      <Button onClick={handleVerify} disabled={isVerifying} className="w-full" variant="outline">
        {isVerifying ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verifying...
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Auto-Verify with Wise Old Man
          </>
        )}
      </Button>

      {verificationResult && (
        <Alert variant={verificationResult.success ? "default" : "destructive"}>
          {verificationResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertTitle>{verificationResult.success ? "Success" : "Verification Failed"}</AlertTitle>
          <AlertDescription>{verificationResult.message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

