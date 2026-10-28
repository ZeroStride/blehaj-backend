import React from "react"

export function useWait(options?: {
  startPaused?: boolean
}): [
  boolean,
  <T>(ms: number, value: T) => Promise<T>,
  <T>(ms: number, value: Promise<T> | undefined) => Promise<T> | undefined,
  boolean,
  React.Dispatch<React.SetStateAction<boolean>>,
] {
  const POLL_INTERVAL: number = 100
  const [waiting, setWaiting] = React.useState(false)
  const [paused, setPaused] = React.useState(false)
  localStorage.setItem("paused", paused ? "true" : "false")

  const wait = React.useEffectEvent(function <T>(
    ms: number,
    value: T
  ): Promise<T> {
    if (localStorage.getItem("noWaitMode") === "true") {
      return Promise.resolve(value)
    }

    function pollPause(resolve: () => void, pollInterval: number) {
      if (localStorage.getItem("paused") === "true") {
        setTimeout(pollPause, pollInterval, resolve, pollInterval)
      } else {
        resolve()
      }
    }

    return new Promise<T>(function (resolve) {
      setWaiting(true)
      setTimeout(
        function (v) {
          pollPause(function () {
            setWaiting(false)
            resolve(v)
          }, POLL_INTERVAL)
        },
        ms,
        value
      )
    })
  })

  const waitAtLeast = React.useEffectEvent(function <T>(
    ms: number,
    value: Promise<T> | undefined
  ): Promise<T> | undefined {
    if (!value || localStorage.getItem("noWaitMode") === "true") {
      return value
    }

    const startedAt = performance.now()
    return value.then(function (resolvedValue) {
      const delta = performance.now() - startedAt
      return new Promise<T>(function (resolve) {
        setWaiting(true)
        setTimeout(
          function (v) {
            setWaiting(false)
            resolve(v)
          },
          Math.floor(ms - delta),
          resolvedValue
        )
      })
    })
  })

  return [waiting, wait, waitAtLeast, paused, setPaused]
}
