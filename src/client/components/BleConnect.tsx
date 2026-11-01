import { setup, types } from "xstate"
import { z } from "zod"

// Todo - Do validated schema for configuration
// z.uuid(), z.uuid() etc
export interface BleConnectConfiguration {
  // Just optional so I can spread operator the app context in
  readonly serviceUuid?: BluetoothServiceUUID
  readonly characteristicUuid: BluetoothCharacteristicUUID | null
  readonly onCharacteristic: (
    characteristic: BluetoothRemoteGATTCharacteristic
  ) => void
  readonly onError: (error: Error) => void
  readonly noWaitMode: boolean
  readonly useEmulator: boolean
}

interface BleConnectContext {
  readonly serviceUuid: BluetoothServiceUUID
  readonly characteristicUuid: BluetoothCharacteristicUUID
  device?: Partial<BluetoothDevice>
  server?: Partial<BluetoothRemoteGATTServer>
  service?: Partial<BluetoothRemoteGATTService>
  characteristic?: Partial<BluetoothRemoteGATTCharacteristic>
}

const handshake = setup({
  schemas: {
    context: types<BleConnectContext>(),
    input: types<Partial<BleConnectConfiguration>>(),
    output: types<BluetoothRemoteGATTCharacteristic>(),
    events: {
      "system.success": types<{
        device?: Partial<BluetoothDevice>
        server?: Partial<BluetoothRemoteGATTServer>
        service?: Partial<BluetoothRemoteGATTService>
        characteristic?: Partial<BluetoothRemoteGATTCharacteristic>
      }>(),
      "user.initiate": z.undefined(),
      "system.reset": z.undefined(),
    },
  },
}).createMachine({
  context: ({ input }) => {
    return {
      serviceUuid: input.serviceUuid!,
      characteristicUuid: input.characteristicUuid!,
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
    label: "Press Connect to Start Scanning",
    description: `In order to use the <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API" target="_blank">Web Bluetooth API</a> the scan must be
                  initiated as a result of user input.
                  <br/><br/>
                  This is a restriction of the browser, to make sure that web apps don't abuse Bluetooth.`,
  },
  {
    label: "Searching for Device",
    description: `The web app is now scanning for Bluetooth devices in range which
                  are advertising the service that \`blehaj\` is running.
                  <br/><br/>
                  That service is designated by long collection of numbers and letters you can see below this box, and in the address bar.
                  <br/><br/>
                  That is called a 'UUID' which is short for Universally Unique Identifier.`,
  },
  {
    label: "Connecting to GATT Server",
    description: `The device has been found, and now a connection is being established
                  to the Bluetooth 'Generic ATTribute Profile' (GATT) Server running on the device.
                  <br/><br/>
                  Bluetooth Low Energey devices communicate using GATT Services and Characteristics.`,
  },
  {
    label: "Getting Primary Service",
    description: `Now finding the GATT Service which hosts the Characteristic for \`blehaj\` configuration on the device
                  <br/><br/>
                  Using GATT Characteristics does not require traditional 'pairing' because they offer more limited functionality.`,
  },
  {
    label: "Getting Configuration Characteristic",
    description: `Now that the Service has been found, we can get the GATT Characteristic.
                  <br/><br/>
                  The 'Characteristic' is what will let us read and write data to the device over Bluetooth.`,
  },
  {
    label: "Handshake Complete",
    description: `The web app can now communicate with \`blehaj\` on the device.`,
  },
]

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
import { useMachine } from "@xstate/react"
import { NotFoundError } from "elysia"
import { MuiMarkdown } from "mui-markdown"
import React from "react"

import { BluetoothDeviceEmulator } from "@client/BluetoothEmulator"
import { useWait } from "@client/wait"
import PauseControl from "@components/PauseControl"

export default function BleConnect({
  serviceUuid,
  characteristicUuid,
  onCharacteristic,
  onError,
  noWaitMode,
  useEmulator,
}: BleConnectConfiguration) {
  const [state, send] = useMachine(handshake, {
    input: {
      serviceUuid,
      characteristicUuid,
    },
  })

  const requestDevice = () => {
    return useEmulator
      ? Promise.resolve(BluetoothDeviceEmulator)
      : navigator.bluetooth.requestDevice({
          filters: [{ services: [state.context.serviceUuid] }],
        })
  }

  const [activeStep, setActiveStep] = React.useState(0)
  const [waiting, wait, waitAtLeast, paused, setPaused] = useWait()

  const connect = React.useEffectEvent(() => {
    send({ type: "user.initiate" })
    setActiveStep(1)
    setPaused(true)

    requestDevice()
      .then((device) => wait(0, device))
      .then(async (device) => {
        send({ type: "system.success", device })
        setActiveStep(2)
        return waitAtLeast(3000, device!.gatt!.connect!())
      })
      .then((server) => {
        send({ type: "system.success", server })
        setActiveStep(3)
        return server!.getPrimaryService(state.context.serviceUuid)
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
  })

  return (
    <>
      <Stepper activeStep={activeStep} orientation="vertical">
        {steps.map((step, index) => (
          <Step key={step.label}>
            <StepLabel>{step.label}</StepLabel>
            <StepContent sx={{ textAlign: "right" }}>
              <Stack direction="row" spacing={-2} sx={{ mr: -1 }}>
                <Container>
                  {index > 0 && (
                    <LinearProgress
                      color={
                        waiting
                          ? paused
                            ? "warning"
                            : "secondary"
                          : "secondary"
                      }
                      aria-label="Waiting..."
                      variant={waiting ? "query" : "indeterminate"}
                    />
                  )}
                  <MuiMarkdown>{step.description}</MuiMarkdown>

                  <Box>
                    {index === 0 && (
                      <Button
                        variant="contained"
                        onClick={connect}
                        sx={{ mt: 1, mr: 1 }}
                        aria-label="connect"
                      >
                        Connect
                      </Button>
                    )}
                  </Box>
                </Container>
                <PauseControl {...{ noWaitMode }} {...{ paused, setPaused }} />
              </Stack>
            </StepContent>
          </Step>
        ))}
      </Stepper>
    </>
  )
}
