"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LogIn, LogOut } from "lucide-react";

// Convert Seconds:Frames (at 30fps) to exact Seconds.
// e.g. 1:25 -> 1s + (25/30)s = 1.833s
const GLITCH_EVENTS = [
  { start: 1.833, end: 2.233 }, // Asli: 1:25 - 2:07
  { start: 3.5, end: 4.0 }, // Asli: 3:15 - 4:00
  { start: 5.2, end: 5.733 }, // Asli: 5:06 - 5:22
  { start: 6.933, end: 7.433 }, // Asli: 6:28 - 7:13
  { start: 8.5, end: 8.8 }, // Asli: 8:15 - 8:24
];

export default function TimeTravel() {
  const { data: session, status } = useSession();

  const ownerUsername = process.env.NEXT_PUBLIC_OWNER_GITHUB_USERNAME || "github";
  const ownerAvatar = `https://github.com/${ownerUsername}.png`;

  const [targetYearInput, setTargetYearInput] = useState("");
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const currentYearRef = useRef<number>(new Date().getFullYear());
  const startYearRef = useRef<number>(new Date().getFullYear());
  const destYearRef = useRef<number>(0);
  const speedRef = useRef<number>(1);
  const baseSpeedRef = useRef<number>(1);
  const isGlitchingRef = useRef<boolean>(false);
  const lockedGlitchIndexRef = useRef<number>(-1);

  // DOM Refs for direct 60fps manipulation without React renders
  const tapeRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const appContainerRef = useRef<HTMLDivElement>(null);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    const dest = parseInt(targetYearInput, 10);
    if (isNaN(dest)) return;

    destYearRef.current = dest;
    const startY = new Date().getFullYear();
    startYearRef.current = startY;
    currentYearRef.current = startY;
    lockedGlitchIndexRef.current = -1;

    let calculatedSpeed = 15;
    if (Math.abs(dest - startY) < 100) {
      calculatedSpeed = Math.abs(dest - startY) / 5;
    } else {
      calculatedSpeed = Math.abs(dest - startY) / 20;
    }
    if (calculatedSpeed < 1) calculatedSpeed = 1;
    speedRef.current = calculatedSpeed;
    baseSpeedRef.current = calculatedSpeed;

    if (!audioRef.current) {
      audioRef.current = new Audio("/musing-mp3.mp3");
      audioRef.current.loop = true;
    }

    audioRef.current.currentTime = 0;

    audioRef.current
      .play()
      .then(() => {
        setIsStarted(true);
        setIsFinished(false);
        lastFrameTimeRef.current = performance.now();
        requestRef.current = requestAnimationFrame(animate);
      })
      .catch((err) => {
        console.error("Audio play failed:", err);
        alert("Mohon interaksi dengan layar (klik di mana saja) agar audio bisa diputar.");
      });
  };

  const handleReset = () => {
    setIsStarted(false);
    setIsFinished(false);
    setTargetYearInput("");
  };

  const animate = (time: number) => {
    if (!audioRef.current) return;

    const dt = (time - lastFrameTimeRef.current) / 1000;
    lastFrameTimeRef.current = time;

    const ct = audioRef.current.currentTime;
    const destYear = destYearRef.current;
    const distance = destYear - currentYearRef.current;
    const direction = destYear >= startYearRef.current ? 1 : -1;

    let glitch = false;
    let nextGlitchStart = Infinity;
    let nextGlitchIndex = -1;

    for (let i = 0; i < GLITCH_EVENTS.length; i++) {
      const ev = GLITCH_EVENTS[i];
      // Shorten glitch duration to max 0.15s for snappy feel
      const glitchDuration = Math.min(ev.end - ev.start, 0.15);
      const glitchEnd = ev.start + glitchDuration;

      if (ct >= ev.start && ct <= glitchEnd) {
        glitch = true;
      }
      if (ev.start > ct && ev.start < nextGlitchStart) {
        nextGlitchStart = ev.start;
        nextGlitchIndex = i;
      }
    }

    // Toggle CSS classes for glitch effect
    if (glitch && !isGlitchingRef.current) {
      leftRef.current?.classList.add("glitch-active");
      centerRef.current?.classList.add("glitch-active");
      rightRef.current?.classList.add("glitch-active");
      isGlitchingRef.current = true;

      // Predictive speed ensures this is <1% off from an integer, so the snap is completely invisible!
      currentYearRef.current = Math.round(currentYearRef.current);
    } else if (!glitch && isGlitchingRef.current) {
      leftRef.current?.classList.remove("glitch-active");
      centerRef.current?.classList.remove("glitch-active");
      rightRef.current?.classList.remove("glitch-active");
      isGlitchingRef.current = false;
    }

    if (glitch) {
      // Glitch: Membeku (Freeze) total
      updateDOM(currentYearRef.current);
    } else {
      let currentSpeed = speedRef.current;

      const timeToGlitch = nextGlitchStart - ct;
      if (timeToGlitch > 0 && timeToGlitch <= 1.0) {
        // PREDICTIVE SPEED ADJUSTMENT
        if (lockedGlitchIndexRef.current !== nextGlitchIndex) {
          // Calculate the expected year at glitch time based on the exact integral of (0.2 + 0.8t)
          const expectedEnd = currentYearRef.current + direction * 0.6 * speedRef.current;
          let targetInteger = Math.round(expectedEnd);

          // Prevent predicting past the final destination
          if (direction === 1 && targetInteger > destYear) targetInteger = destYear;
          if (direction === -1 && targetInteger < destYear) targetInteger = destYear;

          // Re-adjust speed so the covered distance perfectly lands on targetInteger
          const distanceNeeded = Math.abs(targetInteger - currentYearRef.current);
          speedRef.current = distanceNeeded / 0.6;
          lockedGlitchIndexRef.current = nextGlitchIndex;
        }

        const factor = timeToGlitch;
        currentSpeed = speedRef.current * (0.2 + 0.8 * factor);
      } else {
        if (lockedGlitchIndexRef.current !== -1) {
          lockedGlitchIndexRef.current = -1;
          speedRef.current = baseSpeedRef.current; // Restore speed to prevent freezing
        }

        currentSpeed = speedRef.current;

        if (Math.abs(distance) < currentSpeed * 2) {
          // Glide smoothly into place (easing) - ONLY applied if we are not predicting a glitch
          currentSpeed = Math.max(0.5, Math.abs(distance));
        }
      }

      const step = currentSpeed * direction * dt;
      currentYearRef.current += step;

      // Clamp to destination so it doesn't overshoot
      if (
        (direction === 1 && currentYearRef.current >= destYear) ||
        (direction === -1 && currentYearRef.current <= destYear)
      ) {
        currentYearRef.current = destYear;
      }

      updateDOM(currentYearRef.current);

      // Finish exactly when it lands on the number
      if (currentYearRef.current === destYear) {
        setIsFinished(true);
        if (audioRef.current) {
          audioRef.current.pause();
        }
        return; // Stop animation loop
      }
    }

    requestRef.current = requestAnimationFrame(animate);
  };

  const updateDOM = (decimalYear: number) => {
    if (!tapeRef.current || !leftRef.current || !centerRef.current || !rightRef.current) return;

    const baseYear = Math.floor(decimalYear);
    const fraction = decimalYear - baseYear; // 0.0 to 0.999

    tapeRef.current.style.transform = `translateX(-${fraction * 100}%)`;

    const setSlot = (el: HTMLDivElement, year: number) => {
      const txt = year.toString();
      if (el.textContent !== txt) {
        el.textContent = txt;
        el.dataset.text = txt;
      }
    };

    setSlot(leftRef.current, baseYear - 1);
    setSlot(centerRef.current, baseYear);
    setSlot(rightRef.current, baseYear + 1);
  };

  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={appContainerRef}
      className="relative flex flex-col items-center justify-center min-h-screen w-full overflow-hidden transition-colors duration-300 bg-black">
      {!isStarted ? (
        <form onSubmit={handleStart} className="z-10 flex flex-col items-center gap-6 w-full max-w-md px-6">
          <label className="text-lg md:text-xl tracking-widest font-light text-center">
            <span className="uppercase text-white ">To what year will you travel?</span>{" "}
            <span className="text-xs text-white ">(maybe back to your childhood?)</span>
          </label>
          <input
            type="number"
            value={targetYearInput}
            onChange={(e) => setTargetYearInput(e.target.value)}
            className="w-full text-center text-4xl md:text-5xl bg-transparent text-white focus:outline-none pb-4 font-bold tabular-nums"
            placeholder="1990"
            required
          />
          <button
            type="submit"
            className="mt-6 px-8 py-3 text-white bg-zinc-800 hover:bg-zinc-900 transition-colors duration-200 text-sm tracking-widest uppercase">
            Go
          </button>
        </form>
      ) : (
        <div className="z-10 flex flex-col items-center justify-center gap-8">
          <div className="relative pointer-events-none">
            <div
              className="relative w-[300px] md:w-[400px] h-[120px] overflow-hidden"
              style={{
                WebkitMaskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
                maskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
              }}>
              <div ref={tapeRef} className="absolute inset-0 w-full h-full text-white">
                <div
                  ref={leftRef}
                  className="absolute left-[-100%] top-0 w-full h-full flex items-center justify-center text-5xl md:text-6xl font-bold tracking-tighter tabular-nums"
                />
                <div
                  ref={centerRef}
                  className="absolute left-[0%] top-0 w-full h-full flex items-center justify-center text-5xl md:text-6xl font-bold tracking-tighter tabular-nums"
                />
                <div
                  ref={rightRef}
                  className="absolute left-[100%] top-0 w-full h-full flex items-center justify-center text-5xl md:text-6xl font-bold tracking-tighter tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Back button always in DOM to prevent layout shift, fades in when finished */}
          <button
            onClick={handleReset}
            className={`text-white hover:text-neutral-400 transition-all duration-500 text-lg tracking-widest uppercase ${
              isFinished ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}>
            back
          </button>
        </div>
      )}

      {/* Music Credit - Absolute position ensures zero layout shift */}
      <a
        href="https://www.youtube.com/watch?v=D5MlJRboXd0"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 text-zinc-600 hover:text-zinc-400 transition-colors duration-300 text-[10px] sm:text-xs font-light tracking-wider z-20">
        Music by KoRuSe - Two Different Words
      </a>

      {/* GitHub Auth - Avatar Popover */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <Popover>
          <PopoverTrigger asChild>
            <button className="relative rounded-full overflow-hidden w-10 h-10 border-2 border-transparent hover:border-zinc-600 transition-all duration-300 outline-none focus:ring-2 focus:ring-zinc-600 focus:ring-offset-2 focus:ring-offset-black">
              <Avatar className="w-full h-full bg-zinc-900">
                {status !== "loading" && (
                  <AvatarImage src={session?.user?.image || ownerAvatar} alt="Avatar" className="object-cover" />
                )}
                <AvatarFallback className="bg-zinc-900 text-zinc-500 font-mono text-sm animate-pulse">?</AvatarFallback>
              </Avatar>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="end"
            sideOffset={8}
            className="w-auto p-1 bg-zinc-900/90 backdrop-blur-md border-zinc-800 rounded-xl shadow-2xl">
            {session ? (
              <button
                onClick={() => signOut()}
                className="flex items-center gap-3 px-4 py-2.5 w-full text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-lg transition-colors font-medium tracking-wide">
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            ) : (
              <button
                onClick={() => signIn("github")}
                className="flex items-center gap-3 px-4 py-2.5 w-full text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-lg transition-colors font-medium tracking-wide">
                <LogIn className="w-4 h-4" />
                <span>Sign in</span>
              </button>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
