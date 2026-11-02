"use client";

import { motion } from "motion/react";
import { FlowingLogos } from "@/components/ui/logo-cloud-marquee-utils/flowing-logos";
import { cn } from "@/lib/utils";

interface Logo {
  name: string;
  image: string;
}

interface LogoCloudMarqueeProps {
  title?: string;
  description?: string;
  data?: Logo[];
  className?: string;
}

const defaultLogos: Logo[] = [
  {
    image:
      "https://cdn.21st.dev/assets/localized/516a7fa4afe42d07cafad5ba8b7b56b7a56ab67da65ee266570e889c6c766ac3.svg",
    name: "Phoenix",
  },
  {
    image:
      "https://cdn.21st.dev/assets/localized/122afd662757e7d2a4a543ddd3bc338f1327fa6c43de21901a37d25d4a1de18f.svg",
    name: "Oslo",
  },
  {
    image:
      "https://cdn.21st.dev/assets/localized/459715ed01db097ae5374685a01be402de24d5ca2036e659fd8167f4bd1fc1a0.svg",
    name: "Theo",
  },
  {
    image:
      "https://cdn.21st.dev/assets/localized/38ee0fbd73d4af5f27eb3c7dd44dba82774daa6be0fc00b0a355648f5dff3d06.svg",
    name: "Kansas",
  },
  {
    image:
      "https://cdn.21st.dev/assets/localized/97b7a987106206f54e1756842b38ff76361763b824c634e27209fc525315a1e6.svg",
    name: "Cairo",
  },
];

export default function LogoCloudMarquee({
  title = "Built with technologies trusted by",
  description = "ScrollX UI aligns with the ecosystem powering the world’s most ambitious products.",
  data = defaultLogos,
  className,
}: LogoCloudMarqueeProps) {
  const words = title.split(" ");

  return (
    <section className={cn("relative w-full overflow-hidden py-24", className)}>
      <div className="mx-auto max-w-6xl px-6">
        <h1 className="relative z-10 mx-auto max-w-4xl text-center text-3xl font-bold tracking-tight text-zinc-800 md:text-5xl lg:text-6xl dark:text-zinc-100">
          {words.map((word, index) => (
            <motion.span
              key={`${word}-${index}`}
              initial={{ opacity: 0, filter: "blur(6px)", y: 12 }}
              whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.4,
                delay: index * 0.08,
                ease: "easeInOut",
              }}
              className="mr-2 inline-block"
            >
              {word}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative z-10 mx-auto mt-6 max-w-2xl text-center text-base text-zinc-500 dark:text-zinc-400 md:text-lg"
        >
          {description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="relative mt-14"
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-32 bg-linear-to-r from-white via-white/60 to-transparent dark:from-background dark:via-background/60 dark:to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-32 bg-linear-to-l from-white via-white/60 to-transparent dark:from-background dark:via-background/60 dark:to-transparent" />
          <FlowingLogos
            data={data}
            variant="wide"
            className="[--duration:35s]"
          />
        </motion.div>
      </div>
    </section>
  );
}
