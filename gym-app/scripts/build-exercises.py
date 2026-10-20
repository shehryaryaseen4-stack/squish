#!/usr/bin/env python3
"""Builds the exercise library the member app uses for workout plans.

Source: free-exercise-db by yuhonas (public domain, Unlicense)
https://github.com/yuhonas/free-exercise-db

Downloads the chosen exercises, shrinks their two photos (start and end
position, shown alternately as an animation) and writes
public/exercises/library.json plus public/exercises/img/<id>-0.jpg / -1.jpg.

    python3 scripts/build-exercises.py
"""
import io
import json
import os
import re
import sys
import urllib.request

from PIL import Image

BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main'
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'exercises')

# Muscle groups a member picks for each day, and the exercises shown for them,
# most common gym movements first.
GROUPS = {
    'chest': ('Chest', ['Barbell_Bench_Press_-_Medium_Grip', 'Barbell_Incline_Bench_Press_-_Medium_Grip', 'Dumbbell_Bench_Press', 'Incline_Dumbbell_Press', 'Decline_Barbell_Bench_Press', 'Dumbbell_Flyes', 'Incline_Dumbbell_Flyes', 'Cable_Crossover', 'Butterfly', 'Dips_-_Chest_Version', 'Pushups']),
    'back': ('Back', ['Wide-Grip_Lat_Pulldown', 'Pullups', 'Bent_Over_Barbell_Row', 'One-Arm_Dumbbell_Row', 'Seated_Cable_Rows', 'T-Bar_Row_with_Handle', 'Close-Grip_Front_Lat_Pulldown', 'Barbell_Deadlift', 'Hyperextensions_Back_Extensions', 'Straight-Arm_Pulldown']),
    'shoulders': ('Shoulders', ['Dumbbell_Shoulder_Press', 'Standing_Military_Press', 'Arnold_Dumbbell_Press', 'Side_Lateral_Raise', 'Front_Dumbbell_Raise', 'Reverse_Flyes', 'Face_Pull', 'Upright_Barbell_Row', 'Leverage_Shoulder_Press']),
    'traps': ('Traps', ['Barbell_Shrug', 'Dumbbell_Shrug', 'Cable_Shrugs']),
    'biceps': ('Biceps', ['Barbell_Curl', 'Dumbbell_Bicep_Curl', 'Hammer_Curls', 'Preacher_Curl', 'Concentration_Curls', 'EZ-Bar_Curl', 'Standing_Biceps_Cable_Curl', 'Alternate_Incline_Dumbbell_Curl']),
    'triceps': ('Triceps', ['Triceps_Pushdown', 'Triceps_Pushdown_-_Rope_Attachment', 'EZ-Bar_Skullcrusher', 'Close-Grip_Barbell_Bench_Press', 'Cable_Rope_Overhead_Triceps_Extension', 'Bench_Dips', 'Tricep_Dumbbell_Kickback', 'Dips_-_Triceps_Version']),
    'forearms': ('Forearms', ['Palms-Up_Barbell_Wrist_Curl_Over_A_Bench', 'Palms-Down_Wrist_Curl_Over_A_Bench', 'Reverse_Barbell_Curl', 'Farmers_Walk']),
    'legs': ('Legs', ['Barbell_Squat', 'Leg_Press', 'Hack_Squat', 'Leg_Extensions', 'Lying_Leg_Curls', 'Seated_Leg_Curl', 'Romanian_Deadlift', 'Dumbbell_Lunges', 'Barbell_Walking_Lunge', 'Goblet_Squat', 'Barbell_Hip_Thrust']),
    'calves': ('Calves', ['Standing_Calf_Raises', 'Seated_Calf_Raise', 'Calf_Press_On_The_Leg_Press_Machine']),
    'abs': ('Abs', ['Crunches', 'Cable_Crunch', 'Hanging_Leg_Raise', 'Plank', 'Russian_Twist', 'Ab_Roller', 'Flat_Bench_Lying_Leg_Raise', 'Mountain_Climbers', 'Ab_Crunch_Machine']),
    'cardio': ('Cardio', ['Running_Treadmill', 'Walking_Treadmill', 'Bicycling_Stationary', 'Elliptical_Trainer', 'Rowing_Stationary', 'Stairmaster', 'Rope_Jumping', 'Battling_Ropes']),
}


def fetch(path):
    with urllib.request.urlopen(f'{BASE}/{path}', timeout=60) as r:
        return r.read()


def main():
    data = {e['id']: e for e in json.loads(fetch('dist/exercises.json'))}
    missing = [i for _, (_, ids) in GROUPS.items() for i in ids if i not in data]
    if missing:
        sys.exit(f'Not in the dataset: {missing}')
    os.makedirs(os.path.join(OUT, 'img'), exist_ok=True)
    exercises = []
    for group, (_, ids) in GROUPS.items():
        for i in ids:
            e = data[i]
            slug = re.sub('-+', '-', i.lower().replace('_', '-'))
            for n, img in enumerate(e['images'][:2]):
                target = os.path.join(OUT, 'img', f'{slug}-{n}.jpg')
                if not os.path.exists(target):
                    im = Image.open(io.BytesIO(fetch(f'exercises/{img}'))).convert('RGB')
                    im.thumbnail((480, 480))
                    im.save(target, 'JPEG', quality=72, optimize=True, progressive=True)
            exercises.append({
                'id': slug,
                'name': e['name'],
                'group': group,
                'equipment': e.get('equipment') or 'body only',
                'level': e.get('level'),
                'primary': e.get('primaryMuscles', []),
                'secondary': e.get('secondaryMuscles', []),
                'steps': e.get('instructions', []),
                'cardio': e.get('category') == 'cardio',
            })
            print('ok', slug)
    library = {
        'source': 'free-exercise-db by yuhonas (public domain): https://github.com/yuhonas/free-exercise-db',
        'groups': [{'id': g, 'name': name} for g, (name, _) in GROUPS.items()],
        'exercises': exercises,
    }
    with open(os.path.join(OUT, 'library.json'), 'w') as f:
        json.dump(library, f, separators=(',', ':'))
    print(len(exercises), 'exercises')


if __name__ == '__main__':
    main()
