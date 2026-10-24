/// <reference types="web-bluetooth" />
import { useMachine } from "@xstate/react"
import { assign, setup } from "xstate"

export interface BleConnectConfiguration {
  service_uuid: BluetoothServiceUUID
  characteristic_uuid: BluetoothCharacteristicUUID
}

interface BleConnectContext {
  service_uuid: BluetoothServiceUUID
  characteristic_uuid: BluetoothCharacteristicUUID
  device: BluetoothDevice
  server: BluetoothRemoteGATTServer
  service: BluetoothRemoteGATTService
  characteristic: BluetoothRemoteGATTCharacteristic
}

const handshake = setup({
  types: {
    context: {} as Partial<BleConnectContext>,
    input: {} as BleConnectConfiguration,
    output: {} as {
      characteristic: BluetoothRemoteGATTCharacteristic | undefined
    },
  },
}).createMachine({
  context: ({ input }) => ({
    service_uuid: input.service_uuid,
    characteristic_uuid: input.characteristic_uuid,
  }),
  output: ({ context }) => ({
    characteristic: context.characteristic,
  }),
  id: "handshake",
  initial: "ready",
  states: {
    ready: {
      on: { "user.initiate": "request_device" },
    },
    request_device: {
      on: {
        "system.success": {
          target: "connect_gatt",
          actions: assign({
            device: ({ event }) => event.device,
          }),
        },
        "system.error": "error",
      },
    },
    connect_gatt: {
      on: {
        "system.success": {
          target: "get_service_gatt",
          actions: assign({
            server: ({ event }) => event.server,
          }),
        },
        "system.error": "error",
      },
    },
    get_service_gatt: {
      on: {
        "system.success": {
          target: "get_charactaristic_gatt",
          actions: assign({
            service: ({ event }) => event.service,
          }),
        },
        "system.error": "error",
      },
    },
    get_charactaristic_gatt: {
      on: {
        "system.success": {
          target: "success",
          actions: assign({
            characteristic: ({ event }) => event.characteristic,
          }),
        },
        "system.error": "error",
      },
    },
    hist: { type: "history" },
    error: {
      type: "final",
    },
    success: {
      type: "final",
    },
  },
})

export default function BleConnect({
  service_uuid,
  characteristic_uuid,
}: BleConnectConfiguration) {
  const [state, send] = useMachine(handshake, {
    input: {
      service_uuid: service_uuid,
      characteristic_uuid: characteristic_uuid,
    },
  })

  const connect = () => {
    send({ type: "user.initiate" })
    navigator.bluetooth
      .requestDevice({
        filters: [{ services: [state.context.service_uuid] }],
      })
      .then((device) => {
        send({ type: "system.success", device: device })
        console.log(`Got device ${device} connecting to ${device.gatt}...`)
        return device.gatt?.connect()
      })
      .then((server) => {
        send({ type: "system.success", server: server })
        console.log(`Connected, getting service ${state.context.service_uuid}`)
        return server?.getPrimaryService(state.context.service_uuid)
      })
      .then((service) => {
        send({ type: "system.success", service: service })
        console.log(
          `Service found ${service}, connecting to characteristic ${state.context.characteristic_uuid}`
        )
        return service?.getCharacteristic(state.context.characteristic_uuid)
      })
      .then((characteristic) => {
        send({ type: "system.success", characteristic: characteristic })
        console.log(`Characteristic found ${characteristic}, success`)
        return characteristic
      })
      .catch((error) => {
        send({ type: "system.error", error: error })
        console.error(`Something went wrong. ${error}`)
      })
  }

  return (
    <>
      <div className="text-3xl">configure {state.context.service_uuid}</div>
      {state.value === "ready" ? (
        <button
          className="text-xl text-blue-500 px-6 py-2 bg-blue-100 rounded-xl"
          onClick={connect}
        >
          Connect
        </button>
      ) : (
        <div className="text-3xl">{state.value.toString()}</div>
      )}
    </>
  )
}
