import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Loggy</h1>
      <p className="text-muted-foreground">
        Chat in, board out. Setup in progress.
      </p>
      <Button disabled>Start chatting</Button>
    </main>
  );
}
