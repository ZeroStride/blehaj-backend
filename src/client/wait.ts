import React from "react"

export function useWait(options?: {
  pauseTimeout: number
}): [boolean, <T>(ms: number, value: T) => Promise<T>] {
  console.log("evaluating useWait")
  const [waiting, setWaiting] = React.useState(false)

  const wait = React.useEffectEvent(<T>(ms: number, value: T): Promise<T> => {
    if (localStorage.getItem("noWaitMode") === "true") {
      return Promise.resolve(value)
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
  })

  return [waiting, wait]
}
