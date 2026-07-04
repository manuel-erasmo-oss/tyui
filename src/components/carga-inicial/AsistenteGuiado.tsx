'use client'

interface Props {
  onFinish: () => void
}

export function AsistenteGuiado({ onFinish }: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-[#252840] bg-white dark:bg-[#141722] p-6 text-sm text-zinc-500 dark:text-zinc-400">
      Próximamente.
      <button onClick={onFinish} className="ml-2 text-[#1B2980] dark:text-indigo-400 underline">Volver</button>
    </div>
  )
}
