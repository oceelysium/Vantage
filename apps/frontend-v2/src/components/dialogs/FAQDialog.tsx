import { DialogContent, DialogHeader, DialogTitle } from "../common/Dialog";

export function FAQDialog() {
    return (
        <DialogContent class="max-w-2xl">
            <DialogHeader>
                <DialogTitle>FAQ</DialogTitle>
            </DialogHeader>

            <div class="flex flex-col gap-5 text-neutral-300">
                <section>
                    <h3 class="font-title text-base uppercase font-bold tracking-wider text-neutral-100 mb-1">
                        What is Vantage?
                    </h3>
                    <p class="font-body text-sm leading-relaxed">
                        Vantage is a League of Legends draft-analysis tool. As
                        both teams pick, it estimates each side's win
                        probability and ranks every remaining champion by how
                        much it would raise your team's chances — so you can see
                        the strongest pick, and the best role for it, at any
                        point in the draft.
                    </p>
                </section>

                <section>
                    <h3 class="font-title text-base uppercase font-bold tracking-wider text-neutral-100 mb-1">
                        How does the prediction work?
                    </h3>
                    <p class="font-body text-sm leading-relaxed">
                        Vantage uses an Elo-style (log-odds) model rather than a
                        black-box machine-learning model, so every number is
                        explainable. For each possible pick it combines three
                        signals: each champion's base win rate, the synergy of
                        duos within a team, and every matchup between the two
                        teams. Matchups and synergies only contribute the part
                        of their win rate that isn't already explained by the
                        champions' individual strength, so nothing is
                        double-counted. All of these are converted to ratings,
                        summed, and turned back into a single win probability.
                        Each estimate also carries a calibrated ± based on how
                        much data supports it. The core method builds on the
                        approach popularised by{" "}
                        <a
                            href="https://www.youtube.com/@Jayensee"
                            class="text-secondary hover:underline"
                            target="_blank"
                        >
                            Jayensee
                        </a>{" "}
                        (
                        <a
                            href="https://www.youtube.com/watch?v=YQkWmysNBt8"
                            class="text-secondary hover:underline"
                            target="_blank"
                        >
                            video
                        </a>
                        ).
                    </p>
                </section>

                <section>
                    <h3 class="font-title text-base uppercase font-bold tracking-wider text-neutral-100 mb-1">
                        Where is the data from, and what are the tiers?
                    </h3>
                    <p class="font-body text-sm leading-relaxed">
                        Soloqueue mode uses{" "}
                        <a
                            href="https://lolalytics.com"
                            class="text-secondary hover:underline"
                            target="_blank"
                        >
                            lolalytics
                        </a>{" "}
                        ranked solo/duo win rates from every region, over a
                        rolling 30-day window. In Settings you can choose the{" "}
                        <span class="text-neutral-100 font-semibold">
                            level of play
                        </span>{" "}
                        — Platinum+, Emerald+ (default), Diamond+ or Master+ —
                        and the whole dataset switches to that rank bracket. Base
                        win rates come from the current patch and are smoothed
                        toward the 30-day average (so a fresh patch isn't
                        dominated by noise), while matchups and synergies always
                        use the fuller 30-day window.
                    </p>
                </section>

                <section>
                    <h3 class="font-title text-base uppercase font-bold tracking-wider text-neutral-100 mb-1">
                        What is Pro mode?
                    </h3>
                    <p class="font-body text-sm leading-relaxed">
                        Switch{" "}
                        <span class="text-neutral-100 font-semibold">
                            Data source
                        </span>{" "}
                        to Pro in Settings to analyse professional games instead
                        of soloqueue. Vantage builds this dataset from{" "}
                        <a
                            href="https://oracleselixir.com"
                            class="text-secondary hover:underline"
                            target="_blank"
                        >
                            Oracle's Elixir
                        </a>{" "}
                        match data and blends it onto a Diamond+ soloqueue prior
                        — pro samples are small, so blending keeps sparse
                        matchups stable. Pro mode reflects competitive
                        priorities rather than ladder habits. Two caveats: bans
                        and pick order aren't modelled yet, and wherever pro data
                        is thin the estimate leans on champions' base strength.
                    </p>
                </section>

                <section>
                    <h3 class="font-title text-base uppercase font-bold tracking-wider text-neutral-100 mb-1">
                        How does the risk level work?
                    </h3>
                    <p class="font-body text-sm leading-relaxed">
                        Risk level controls how much Vantage trusts small
                        samples. Higher risk surfaces niche duos and counters
                        with little data — potentially strong, but less certain.
                        Lower risk sticks to well-sampled, reliable picks. Under
                        the hood it sets the strength of the statistical prior
                        that thin samples are smoothed toward: high risk = weak
                        prior (trust the small sample), low risk = strong prior
                        (trust the broader average).
                    </p>
                </section>

                <section>
                    <h3 class="font-title text-base uppercase font-bold tracking-wider text-neutral-100 mb-1">
                        What do the ± and "THIN" tags mean?
                    </h3>
                    <p class="font-body text-sm leading-relaxed">
                        The ± next to a win probability is one standard error —
                        how much the estimate could move given the sample sizes
                        behind it. A wider ± means fewer games support that
                        prediction. The{" "}
                        <span class="text-neutral-100 font-semibold">THIN</span>{" "}
                        tag in the header flags that the current patch still has
                        relatively little data, so base win rates are being
                        smoothed toward the 30-day average until more games
                        accumulate.
                    </p>
                </section>

                <section>
                    <h3 class="font-title text-base uppercase font-bold tracking-wider text-neutral-100 mb-1">
                        What are the limitations?
                    </h3>
                    <p class="font-body text-sm leading-relaxed">
                        Vantage models champions, pairwise matchups and pairwise
                        synergies — but not overall composition identity
                        (engage, poke, dive) or interactions among three or more
                        champions. Damage profile and power-spike timing are
                        shown but not fed into the win probability, so weigh
                        those yourself. Because it runs on aggregate historical
                        data, it can't account for bans, draft order or the
                        specific players in the game. Treat the output as strong
                        guidance, not certainty — always sanity-check the ± and
                        the sample size.
                    </p>
                </section>

                <p class="font-body text-sm font-bold text-neutral-200">
                    Questions, feedback, bug reports or feature requests? Email{" "}
                    <a
                        href="mailto:oceelysium@gmail.com"
                        class="text-secondary font-normal hover:underline"
                        target="_blank"
                    >
                        oceelysium@gmail.com
                    </a>
                </p>
            </div>
        </DialogContent>
    );
}
