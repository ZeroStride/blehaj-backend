import React from "react"

import { useWait } from "@client/wait"
import MarkdownStepper from "@components/MarkdownStepper"

const steps = [
  {
    label: "Talking to Device",
    description: `Getting the value from the GATT Characteristic`,
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
]

export default function ReadConfigurationRequest({
  characteristic,
  onComplete,
  noWaitMode,
}: {
  characteristic?: BluetoothRemoteGATTCharacteristic
  onComplete?: ({
    configuration_parameters,
    nonce,
  }: {
    configuration_parameters: string
    nonce: string
  }) => void
  noWaitMode: boolean
}) {
  const [activeStep, setActiveStep] = React.useState(0)
  const [waiting, wait, waitAtLeast, paused, setPaused] = useWait()

  React.useEffect(() => {
    setActiveStep(0)

    characteristic
      ?.readValue()
      .then((value) => wait(3000, value))
      .then((value) => {
        setActiveStep(1)
        return fetch("/api/configure", {
          method: "POST",
          headers: {
            "Content-Type": "application/blehaj",
          },
          body: value.buffer as BodyInit,
        })
      })
      .then((response) => wait(3000, response))
      .then((response) => {
        setActiveStep(2)
        return response.json()
      })
      .then((json) => wait(3000, json))
      .then((json) => {
        onComplete?.call(null, json)
      })
  }, [])

  return (
    <MarkdownStepper
      {...{ activeStep, waiting, steps, noWaitMode, paused, setPaused }}
    />
  )
}
