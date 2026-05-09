"use client";

import Image from "next/image";

type Mood = "idle" | "listening" | "frown" | "think" | "smile" | "drill";

type SpriteCharacterProps = {
  mood: Mood;
  speaking?: boolean;
  size?: number;
};

export default function SpriteCharacter({
  mood,
  speaking = false,
  size = 120,
}: SpriteCharacterProps) {
  return (
    <div
      className="relative select-none"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Companion is ${mood}${speaking ? " and speaking" : ""}`}
    >
      <Image
        src={`/companion/${mood}.svg`}
        alt={mood}
        width={size}
        height={size}
        className={speaking ? "animate-wiggle" : ""}
        priority
      />
      {speaking && (
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 animate-pulse-green" />
      )}
    </div>
  );
}
