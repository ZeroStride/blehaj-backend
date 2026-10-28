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
    label: "Talking to Device",
    description: `Getting the value from the GATT Characteristic`,
  },
  {
    label: "Gathering Required Information",
    description:
      "The server needs to know what WiFi network it should tell the device to connect to.",
  },
  {
    label: "Passing Value to Server",
    description: `The value retrieved from the GATT Characteristic is enrypted, using [ML-KEM](https://en.wikipedia.org/wiki/ML-KEM)
                        encryption, also known as \`Kyber\`. This means that the web application can't read it, but the backend server can.`,
  },
  {
    label: "Waiting for Reply",
    description: `The server is decrypting the request from the device, and then it will tell the web app what information it needs from
                        the user.`,
  },
  {
    label: "Passing Value to Device",
    description: `The value from the server is also encrypted ([ML-KEM](https://en.wikipedia.org/wiki/ML-KEM))
                  The web application can't read it, but the device can.`,
  },
]

export default function ConfigureWiFi({
  characteristic,
  nonce,
  onComplete,
  noWaitMode,
}: {
  characteristic?: BluetoothRemoteGATTCharacteristic
  nonce: string
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

    await characteristic?.startNotifications().then(() => {
      characteristic.addEventListener(
        "characteristicvaluechanged",
        async (ev) => {
          await characteristic.stopNotifications()
          onComplete?.call(null, ev)
        }
      )
    })

    await fetch("/api/nonce", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nonce,
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
      .catch((error) => console.error(error))
  }

  return (
    <Stepper activeStep={activeStep} orientation="vertical">
      {steps.map((step, index) => (
        <Step key={step.label}>
          <StepLabel>{step.label}</StepLabel>
          <StepContent sx={{ textAlign: "right" }}>
            <Stack direction="row" spacing={-2}>
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
