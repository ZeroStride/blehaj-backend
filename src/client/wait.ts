import React from "react"

export function useWait(options?: {
  pauseTimeout: number
}): [
  boolean,
  <T>(ms: number, value: T) => Promise<T>,
  <T>(ms: number, value: Promise<T> | undefined) => Promise<T> | undefined,
] {
  console.log("evaluating useWait")
  const [waiting, setWaiting] = React.useState(false)

  const wait = React.useEffectEvent(<T>(ms: number, value: T): Promise<T> => {
    if (localStorage.getItem("noWaitMode") === "true") {
      return Promise.resolve(value)
    }

    return new Promise<T>((resolve) => {
      setWaiting(true)
      setTimeout(
        (v) => {
          setWaiting(false)
          resolve(v)
        },
        ms,
        value
      )
    })
  })

  const waitAtLeast = React.useEffectEvent(
    <T>(ms: number, value: Promise<T> | undefined): Promise<T> | undefined => {
      if (!value || localStorage.getItem("noWaitMode") === "true") {
        return value
      }

      const startedAt = performance.now()
      return value.then((resolvedValue) => {
        const delta = performance.now() - startedAt
        return new Promise<T>((resolve) => {
          setWaiting(true)
          setTimeout(
            (v) => {
              setWaiting(false)
              resolve(v)
            },
            Math.floor(ms - delta),
            resolvedValue
          )
        })
      })
    }
  )

  return [waiting, wait, waitAtLeast]
}
