import { useMachine } from "@xstate/react"
import { assign, enqueueActions, setup } from "xstate"

export interface BleConnectConfiguration {
  readonly serviceUuid: BluetoothServiceUUID
  readonly characteristicUuid: BluetoothCharacteristicUUID
  readonly onCharacteristic?: (
    characteristic: BluetoothRemoteGATTCharacteristic
  ) => void
  readonly onError?: (error: Error) => void
}

interface BleConnectContext {
  readonly configuration: BleConnectConfiguration
  device?: BluetoothDevice
  server?: BluetoothRemoteGATTServer
  service?: BluetoothRemoteGATTService
  characteristic?: BluetoothRemoteGATTCharacteristic
  error?: Error
}

const handshake = setup({
  types: {
    context: {} as BleConnectContext,
    input: {} as BleConnectConfiguration,
    output: {} as {
      readonly characteristic?: BluetoothRemoteGATTCharacteristic
      readonly error?: Error
    },
  },
}).createMachine({
  context: ({ input }) => {
    return {
      configuration: input,
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
      entry: enqueueActions(({ enqueue, event, context }) => {
        console.error(`Error in state ${event.type}: `, event.error)
        enqueue.assign({
          error: event.error,
        })
        context.configuration.onError?.call(null, event.error)
      }),
    },
    success: {
      type: "final",
      entry: ({ context }) => {
        context.configuration.onCharacteristic?.call(
          null,
          context.characteristic!
        )
      },
    },
  },
})

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
      onCharacteristic,
      onError,
    },
  })

  const connect = () => {
    send({ type: "user.initiate" })
    navigator.bluetooth
      .requestDevice({
        filters: [{ services: [state.context.configuration.serviceUuid] }],
      })
      .then((device) => {
        send({ type: "system.success", device })
        return device.gatt?.connect()
      })
      .then((server) => {
        send({ type: "system.success", server })
        return server?.getPrimaryService(
          state.context.configuration.serviceUuid
        )
      })
      .then((service) => {
        send({ type: "system.success", service })
        return service?.getCharacteristic(
          state.context.configuration.characteristicUuid
        )
      })
      .then((characteristic) => {
        send({ type: "system.success", characteristic })
      })
      .catch((error) => {
        send({ type: "system.error", error })
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
