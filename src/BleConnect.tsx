/// <reference types="web-bluetooth" />
import { useMachine } from "@xstate/react"
import { assign, enqueueActions, setup } from "xstate"

export interface BleConnectConfiguration {
  readonly serviceUuid: BluetoothServiceUUID
  readonly characteristicUuid: BluetoothCharacteristicUUID
}

interface BleConnectContext {
  readonly serviceUuid: BluetoothServiceUUID
  readonly characteristicUuid: BluetoothCharacteristicUUID
  device: BluetoothDevice | null
  server: BluetoothRemoteGATTServer | null
  service: BluetoothRemoteGATTService | null
  characteristic: BluetoothRemoteGATTCharacteristic | null
  error: Error | null
}

const handshake = setup({
  types: {
    context: {} as BleConnectContext,
    input: {} as BleConnectConfiguration,
    output: {} as {
      readonly characteristic: BluetoothRemoteGATTCharacteristic | null
      readonly error: Error | null
    },
  },
}).createMachine({
  context: ({ input }) => {
    return {
      serviceUuid: input.serviceUuid,
      characteristicUuid: input.characteristicUuid,
      device: null,
      server: null,
      service: null,
      characteristic: null,
      error: null,
    }
  },
  output: ({ context }) => ({
    characteristic: context.characteristic,
    error: context.error,
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
      entry: enqueueActions(({ enqueue, event }) => {
        console.error(`Error in state ${event.type}: `, event.error)
        enqueue.assign({
          error: event.error,
        })
      }),
    },
    success: {
      type: "final",
    },
  },
})

export default function BleConnect({
  serviceUuid,
  characteristicUuid,
}: BleConnectConfiguration) {
  const [state, send] = useMachine(handshake, {
    input: {
      serviceUuid: serviceUuid,
      characteristicUuid: characteristicUuid,
    },
  })

  const connect = () => {
    send({ type: "user.initiate" })
    navigator.bluetooth
      .requestDevice({
        filters: [{ services: [state.context.serviceUuid] }],
      })
      .then((device) => {
        send({ type: "system.success", device: device })
        console.log(`Got device ${device} connecting to ${device.gatt}...`)
        return device.gatt?.connect()
      })
      .then((server) => {
        send({ type: "system.success", server: server })
        console.log(`Connected, getting service ${state.context.serviceUuid}`)
        return server?.getPrimaryService(state.context.serviceUuid)
      })
      .then((service) => {
        send({ type: "system.success", service: service })
        console.log(
          `Service found ${service}, connecting to characteristic ${state.context.characteristicUuid}`
        )
        return service?.getCharacteristic(state.context.characteristicUuid)
      })
      .then((characteristic) => {
        send({ type: "system.success", characteristic: characteristic })
        console.log(`Characteristic found ${characteristic}, success`)
        return characteristic
      })
      .catch((error) => {
        send({ type: "system.error", error: error })
      })
  }

  return (
    <div className="flex flex-col gap-x-4 pt-2">
      {state.value === "ready" ? (
        <button
          className="text-xl text-violet-500 px-6 py-2 bg-blue-100 rounded-xl"
          onClick={connect}
        >
          Connect
        </button>
      ) : (
        <div className="px-2 py-1 rounded-xl bg-zinc-800 shadow-lg outline outline-violet/5">
          <p className="text-3xl text-violet-50">
            State: {state.value.toString()}
          </p>
          <p className="text-s text-rose-300">
            {state.output?.error?.toString()}
          </p>
        </div>
      )}
    </div>
  )
}
