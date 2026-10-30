import React from "react"

import { useWait } from "@client/wait"
import MarkdownStepper from "@components/MarkdownStepper"

const steps = [
  {
    label: "Talking to Device",
    description: `Getting the value from the GATT Characteristic. This is a request for configuration, signed with the device's
                  <a href="https://en.wikipedia.org/wiki/EdDSA#Ed25519" target="_blank">Ed25519</a> signing key. The signature lets the server know that the message it gets passed is authentic, since
                  that message is going to be relayed via the Smartphone.`,
  },
  {
    label: "Passing Value to Server",
    description: `The device is also sending along an <a href="https://en.wikipedia.org/wiki/ML-KEM" target="_blank">ML-KEM</a> encapsulation key. This will alllow the server to reply
                  with an encrypted configuration, that cannot be read by the Smartphone which is relaying the data (or any other observer).`,
  },
  {
    label: "Waiting for Reply",
    description: `The server is processing from the device, and then it will tell the web app what information it needs from
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
    session,
  }: {
    configuration_parameters: string
    session: string
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
