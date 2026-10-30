import {
  Box,
  Button,
  Container,
  LinearProgress,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
} from "@mui/material"
import { Scanner } from "@yudiel/react-qr-scanner"
import { MuiMarkdown } from "mui-markdown"
import React, { useEffect } from "react"

import { useWait } from "@client/wait"
import PauseControl from "@components/PauseControl"

const steps = [
  {
    label: "Scan QR code or Enter Manually",
    description: `The server needs to know what WiFi network the device should connect to. How should we gather that?`,
  },
  {
    label: "Code Scanner",
    description: "Scan a WiFi QR code.",
  },
  {
    label: "Sending WiFi info to Server",
    description: `Now sending the WiFi information provided to the server. It will use the encapsulated key (that the device sent) 
                  to create an encrypted configuration specifically for that device, that only it can read.`,
  },
  {
    label: "Waiting for Reply",
    description: `The server will also send along its own encapsulated key, and a signature, so that the device knows it comes from an authoritative source.`,
  },
  {
    label: "Passing Value to Device",
    description: `The encryption is AES-256-GCM, using the shared secret from the ML-KEM exchange; and then signed using provisioned Ed25519 keys.
                  Post-quantum secure, and authenticated communication.`,
  },
]

export default function ConfigureWiFi({
  characteristic,
  session,
  onComplete,
  noWaitMode,
}: {
  characteristic?: BluetoothRemoteGATTCharacteristic
  session: string
  onComplete?: (confirmation: object) => void
  noWaitMode: boolean
}) {
  const [activeStep, setActiveStep] = React.useState(0)
  const [waiting, wait, waitAtLeast, paused, setPaused] = useWait()

  useEffect(() => {
    if (localStorage.getItem("noWaitMode") === "true") {
      setActiveStep(1)
    }
  })

  async function processWiFiInfo({
    ssid,
    security,
    psk,
  }: {
    ssid: string
    security: string
    psk?: string
  }) {
    setActiveStep(2)

    await fetch("/api/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session,
        ssid,
        security,
        psk,
      }),
    })
      .then((response) => response.arrayBuffer())
      .then((body) => wait(3000, body))
      .then((body) => {
        setActiveStep(3)
        return body
      })
      .then((body) => wait(3000, body))
      .then((body) => characteristic?.writeValue(body))
      .then(() => {})
      .then(() => wait(3000, null))
      .then(() => {
        onComplete?.call(null, {})
      })
      .catch((error) => console.error(error))
  }

  return (
    <Stepper activeStep={activeStep} orientation="vertical">
      {steps.map((step, index) => (
        <Step key={step.label}>
          <StepLabel>{step.label}</StepLabel>
          <StepContent sx={{ textAlign: "right" }}>
            <Stack direction="row" spacing={-2} sx={{ mr: -1 }}>
              <Container>
                {waiting && (
                  <LinearProgress
                    color={
                      waiting ? (paused ? "warning" : "secondary") : "secondary"
                    }
                    aria-label="Waiting..."
                    variant={waiting ? "query" : "indeterminate"}
                  />
                )}
                <MuiMarkdown>{step.description}</MuiMarkdown>
                <Box sx={{ mb: 2 }}>
                  {index === 0 && (
                    <>
                      <Button
                        variant="contained"
                        disabled={true}
                        sx={{ mt: 1, mr: 1 }}
                      >
                        Enter Manually
                      </Button>
                      <Button
                        variant="contained"
                        onClick={() => {
                          setActiveStep(1)
                        }}
                        sx={{ mt: 1, mr: 1 }}
                      >
                        Scan QR Code
                      </Button>
                    </>
                  )}
                  {index === 1 && (
                    <Container maxWidth="xs">
                      <Scanner
                        onScan={async (detectedCodes) => {
                          const qr_match = /WIFI:S:(.+);T:(\w+);P:(.*);H:/
                          for (var i = detectedCodes.length - 1; i >= 0; i--) {
                            const match =
                              detectedCodes[i]?.rawValue.match(qr_match)
                            if (match && match[1] && match[2]) {
                              await processWiFiInfo({
                                ssid: match[1],
                                security: match[2],
                                psk: match[3],
                              })
                              break
                            }
                          }
                        }}
                        sound={false}
                      />
                    </Container>
                  )}
                </Box>
              </Container>
              {index > 1 && (
                <PauseControl {...{ noWaitMode }} {...{ paused, setPaused }} />
              )}
            </Stack>
          </StepContent>
        </Step>
      ))}
    </Stepper>
  )
}
