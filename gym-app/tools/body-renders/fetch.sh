#!/bin/sh
# Downloads the MakeHuman base mesh, body targets and bone weights (all CC0).
set -e
cd "$(dirname "$0")"
R=https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data
mkdir -p t
curl -fsS -o base.obj $R/3dobjs/base.obj
curl -fsS -o weights.mhw $R/rigs/default_weights.mhw
for s in male female; do
  for e in african asian caucasian; do curl -fsS -o t/$e-$s-young.target $R/targets/macrodetails/$e-$s-young.target; done
  for m in min average max; do for w in min average max; do
    curl -fsS -o t/universal-$s-young-${m}muscle-${w}weight.target $R/targets/macrodetails/universal-$s-young-${m}muscle-${w}weight.target
  done; done
done
curl -fsS -o t/stomach-pregnant-incr.target $R/targets/stomach/stomach-pregnant-incr.target
curl -fsS -o t/female-young-averagemuscle-averageweight-mincup-averagefirmness.target $R/targets/breast/female-young-averagemuscle-averageweight-mincup-averagefirmness.target
