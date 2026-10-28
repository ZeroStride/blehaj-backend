import { setup, types } from "xstate"
import { z } from "zod"

// Todo - Do validated schema for configuration
// z.uuid(), z.uuid() etc
export interface BleConnectConfiguration {
  readonly serviceUuid: BluetoothServiceUUID
  readonly characteristicUuid: BluetoothCharacteristicUUID
  readonly onCharacteristic?: (
    characteristic: BluetoothRemoteGATTCharacteristic
  ) => void
  readonly onError?: (error: Error) => void
}

interface BleConnectContext {
  readonly serviceUuid: BluetoothServiceUUID
  readonly characteristicUuid: BluetoothCharacteristicUUID
  device?: BluetoothDevice
  server?: BluetoothRemoteGATTServer
  service?: BluetoothRemoteGATTService
  characteristic?: BluetoothRemoteGATTCharacteristic
}

const handshake = setup({
  schemas: {
    context: types<BleConnectContext>(),
    input: types<BleConnectConfiguration>(),
    output: types<BluetoothRemoteGATTCharacteristic>(),
    events: {
      "system.success": types<{
        device?: BluetoothDevice
        server?: BluetoothRemoteGATTServer
        service?: BluetoothRemoteGATTService
        characteristic?: BluetoothRemoteGATTCharacteristic
      }>(),
      "user.initiate": z.undefined(),
      "system.reset": z.undefined(),
    },
  },
}).createMachine({
  context: ({ input }) => {
    return {
      serviceUuid: input.serviceUuid,
      characteristicUuid: input.characteristicUuid,
    }
  },
  id: "handshake",
  initial: "ready",
  states: {
    ready: {
      on: {
        "user.initiate": { target: "request_device" },
      },
    },
    request_device: {
      on: {
        "system.success": ({ event }) => ({
          context: { device: event.device },
          target: "connect_gatt",
        }),
        "system.reset": { target: "ready" },
      },
    },
    connect_gatt: {
      on: {
        "system.success": ({ event }) => ({
          target: "get_service_gatt",
          context: { server: event.server },
        }),
      },
    },
    get_service_gatt: {
      on: {
        "system.success": ({ event }) => ({
          target: "get_charactaristic_gatt",
          context: { service: event.service },
        }),
      },
    },
    get_charactaristic_gatt: {
      on: {
        "system.success": {
          target: "success",
        },
      },
    },
    success: {
      type: "final",
      output: ({ event }: { event: any }) => event.characteristic!,
    },
  },
})

const steps = [
  {
    label: "Press Connect to Begin",
    description: `In order to use the [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API) it must be
                  called as a result of user input. This is a restriction of the browser, to make sure that web apps don't abuse Bluetooth.`,
  },
  {
    label: "Searching for Device",
    description: `The web app is now scanning for Bluetooth devices in range which
                  are advertising the service that \`blehaj\` is running. This is the
                  long collection of numbers and letters you can see below this box, and in the address bar.
                  That is called a 'UUID' which is short for Universally Unique Identifier.`,
  },
  {
    label: "Connecting to GATT Server",
    description: `The device has been found, and now a connection is being established
                  to the Bluetooth 'Generic ATTribute Profile' (GATT) Server running on the device.
                  Bluetooth Low Energey devices communicate using GATT Services and Characteristics.`,
  },
  {
    label: "Getting Primary Service",
    description: `This is the GATT Service which hosts the Characteristic for \`blehaj\` configuration on the device`,
  },
  {
    label: "Getting Configuration Characteristic",
    description: `Now that the Service has been found, we can get the Characteristic that we will use to
                  communicate with \`blehaj\` on the device.`,
  },
  {
    label: "Handshake Complete",
    description: `The web app can now communicate with \`blehaj\` on the device.`,
  },
]

import {
  Box,
  Button,
  LinearProgress,
  Step,
  StepContent,
  StepLabel,
  Stepper,
} from "@mui/material"
import { useMachine } from "@xstate/react"
import { NotFoundError } from "elysia"
import { MuiMarkdown } from "mui-markdown"
import React from "react"

export default function BleConnect({
  serviceUuid,
  characteristicUuid,
  onCharacteristic,
  onError,
}: BleConnectConfiguration) {
  const [state, send] = useMachine(handshake, {
    input: {
      serviceUuid,
      characteristicUuid,
    },
  })

  const [activeStep, setActiveStep] = React.useState(0)
  const [waiting, setWaiting] = React.useState(false)

  function wait<T>(ms: number, value: T) {
    if (localStorage.getItem("noWaitMode") === "true") {
      return value
    }

    return new Promise<T>((resolve) => {
      setWaiting(true)
      return setTimeout(
        (v) => {
          setWaiting(false)
          resolve(v)
        },
        ms,
        value
      )
    })
  }

  const connect = () => {
    send({ type: "user.initiate" })
    setActiveStep(1)

    navigator.bluetooth
      .requestDevice({
        filters: [{ services: [state.context.serviceUuid] }],
      })
      .then((device) => {
        send({ type: "system.success", device })
        setActiveStep(2)
        return device.gatt?.connect()
      })
      .then((server) => {
        send({ type: "system.success", server })
        setActiveStep(3)
        return server?.getPrimaryService(state.context.serviceUuid)
      })
      .then((service) => wait(3000, service))
      .then((service) => {
        send({ type: "system.success", service })
        setActiveStep(4)
        return service?.getCharacteristic(state.context.characteristicUuid)
      })
      .then((characteristic) => wait(3000, characteristic))
      .then((characteristic) => {
        setActiveStep(5)
        return wait(3000, characteristic)
      })
      .then((characteristic) => onCharacteristic?.call(null, characteristic!))
      .catch((error: Error) => {
        console.error(error)
        if (error instanceof NotFoundError) {
          setActiveStep(0)
        } else {
          onError?.call(null, error)
        }
      })
  }

  return (
    <>
      <Stepper activeStep={activeStep} orientation="vertical">
        {steps.map((step, index) => (
          <Step key={step.label}>
            <StepLabel>{step.label}</StepLabel>
            <StepContent sx={{ textAlign: "right" }}>
              {index > 0 &&
                (waiting ? (
                  <LinearProgress color="secondary" aria-label="Loading..." />
                ) : (
                  <LinearProgress
                    color="secondary"
                    aria-label="Waiting..."
                    variant="query"
                  />
                ))}
              <MuiMarkdown>{step.description}</MuiMarkdown>

              <Box sx={{ mb: 2 }}>
                {index === 0 && (
                  <Button
                    variant="contained"
                    onClick={connect}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Connect
                  </Button>
                )}
              </Box>
            </StepContent>
          </Step>
        ))}
      </Stepper>
    </>
  )
}
