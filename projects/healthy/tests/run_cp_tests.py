"""
Script para ejecutar los tests de evaluacion CP-01..CP-10 contra staging.
"""
import urllib.request, json, sys

BASE = "https://backend-staging-01ee.up.railway.app"

def api(method, path, data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(data).encode() if data else None,
        headers=headers,
        method=method
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except:
            return {"success": False, "error": f"HTTP {e.code}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def get_token(n):
    email = f"eval_20260902_{n:02d}@healthyapp.test"
    r = api("POST", "/auth/login", {"email": email, "password": "EvalTest2026!"})
    if not r:
        return ""
    return (r.get("data") or {}).get("access_token", "")

def complete_onboarding(token, profile, lifestyle, training, nutrition, health, motivation):
    api("PUT", "/onboarding/profile", profile, token)
    api("PUT", "/onboarding/lifestyle", lifestyle, token)
    api("PUT", "/onboarding/training", training, token)
    api("PUT", "/onboarding/nutrition", nutrition, token)
    api("PUT", "/onboarding/health", health, token)
    api("PUT", "/onboarding/motivation", motivation, token)
    return api("POST", "/onboarding/complete", {}, token)

profiles = {
    2: {
        "profile": {"name":"Marco G","birthdate":"2001-01-15","gender":"male","weight_kg":80,"height_cm":178,"body_type":"mesomorph","activity_level":"active","goal":"gain_muscle"},
        "lifestyle": {"profession":"Engineer","stress_level":2,"sleep_hours_usual":8,"sleep_quality":"good","smoker":False},
        "training": {"available_days_per_week":5,"max_session_duration_minutes":75,"has_gym_access":True,"home_equipment":"full","experience_level":"intermediate"},
        "nutrition": {"diet_type":"omnivore","meals_per_day_preferred":5},
        "health": {"conditions":[]},
        "motivation": {"main_motivation":"appearance","tracking_preference":"detailed"}
    },
    3: {
        "profile": {"name":"Pedro M","birthdate":"1984-07-22","gender":"male","weight_kg":88,"height_cm":175,"body_type":"mesomorph","activity_level":"light","goal":"general_health"},
        "lifestyle": {"profession":"Engineer","stress_level":3,"sleep_hours_usual":7,"sleep_quality":"good","smoker":False},
        "training": {"available_days_per_week":3,"max_session_duration_minutes":60,"has_gym_access":True,"home_equipment":"none","experience_level":"intermediate","injuries_or_limitations":"lesion de rodilla derecha, dolor al flexionar mas de 90 grados"},
        "nutrition": {"diet_type":"omnivore","meals_per_day_preferred":3},
        "health": {"conditions":["knee_injury"]},
        "motivation": {"main_motivation":"health","tracking_preference":"basic"}
    },
    4: {
        "profile": {"name":"Ana V","birthdate":"1997-05-10","gender":"female","weight_kg":65,"height_cm":163,"body_type":"ectomorph","activity_level":"light","goal":"lose_weight"},
        "lifestyle": {"profession":"Teacher","stress_level":3,"sleep_hours_usual":7,"sleep_quality":"good","smoker":False},
        "training": {"available_days_per_week":4,"max_session_duration_minutes":45,"has_gym_access":False,"home_equipment":"none","experience_level":"beginner"},
        "nutrition": {"diet_type":"vegan","meals_per_day_preferred":4},
        "health": {"conditions":[]},
        "motivation": {"main_motivation":"health","tracking_preference":"basic"}
    },
    5: {
        "profile": {"name":"Luis R","birthdate":"1971-03-08","gender":"male","weight_kg":92,"height_cm":172,"body_type":"endomorph","activity_level":"sedentary","goal":"general_health"},
        "lifestyle": {"profession":"Manager","stress_level":4,"sleep_hours_usual":6,"sleep_quality":"regular","smoker":False},
        "training": {"available_days_per_week":3,"max_session_duration_minutes":40,"has_gym_access":False,"home_equipment":"none","experience_level":"beginner"},
        "nutrition": {"diet_type":"omnivore","meals_per_day_preferred":3},
        "health": {"conditions":["diabetes_tipo_2"]},
        "motivation": {"main_motivation":"health","tracking_preference":"basic"}
    },
    6: {
        "profile": {"name":"Sara L","birthdate":"1995-08-20","gender":"female","weight_kg":72,"height_cm":167,"body_type":"endomorph","activity_level":"sedentary","goal":"lose_weight"},
        "lifestyle": {"profession":"Nurse","stress_level":3,"sleep_hours_usual":7,"sleep_quality":"good","smoker":False},
        "training": {"available_days_per_week":4,"max_session_duration_minutes":45,"has_gym_access":False,"home_equipment":"none","experience_level":"beginner"},
        "nutrition": {"diet_type":"omnivore","meals_per_day_preferred":3},
        "health": {"conditions":[]},
        "motivation": {"main_motivation":"appearance","tracking_preference":"basic"}
    },
    7: {
        "profile": {"name":"Javi M","birthdate":"1988-11-05","gender":"male","weight_kg":75,"height_cm":180,"body_type":"mesomorph","activity_level":"light","goal":"maintain"},
        "lifestyle": {"profession":"Consultant","stress_level":4,"sleep_hours_usual":7,"sleep_quality":"good","smoker":False},
        "training": {"available_days_per_week":3,"max_session_duration_minutes":45,"has_gym_access":True,"home_equipment":"none","experience_level":"intermediate"},
        "nutrition": {"diet_type":"omnivore","meals_per_day_preferred":3},
        "health": {"conditions":[]},
        "motivation": {"main_motivation":"health","tracking_preference":"basic"}
    },
    8: {
        "profile": {"name":"Maria B","birthdate":"1986-06-15","gender":"female","weight_kg":75,"height_cm":162,"body_type":"mesomorph","activity_level":"sedentary","goal":"lose_weight"},
        "lifestyle": {"profession":"Doctor","stress_level":4,"sleep_hours_usual":6,"sleep_quality":"regular","smoker":False},
        "training": {"available_days_per_week":3,"max_session_duration_minutes":40,"has_gym_access":False,"home_equipment":"none","experience_level":"beginner"},
        "nutrition": {"diet_type":"omnivore","meals_per_day_preferred":3},
        "health": {"conditions":[]},
        "motivation": {"main_motivation":"health","tracking_preference":"basic"}
    },
    9: {
        "profile": {"name":"Carlos A","birthdate":"1996-02-28","gender":"male","weight_kg":85,"height_cm":182,"body_type":"mesomorph","activity_level":"very_active","goal":"gain_muscle"},
        "lifestyle": {"profession":"Personal trainer","stress_level":2,"sleep_hours_usual":8,"sleep_quality":"good","smoker":False},
        "training": {"available_days_per_week":6,"max_session_duration_minutes":90,"has_gym_access":True,"home_equipment":"full","experience_level":"advanced"},
        "nutrition": {"diet_type":"omnivore","meals_per_day_preferred":5},
        "health": {"conditions":[]},
        "motivation": {"main_motivation":"performance","tracking_preference":"detailed"}
    },
    10: {
        "profile": {"name":"Elena P","birthdate":"1979-09-12","gender":"female","weight_kg":82,"height_cm":168,"body_type":"endomorph","activity_level":"sedentary","goal":"lose_weight"},
        "lifestyle": {"profession":"Accountant","stress_level":4,"sleep_hours_usual":7,"sleep_quality":"regular","smoker":False},
        "training": {"available_days_per_week":3,"max_session_duration_minutes":40,"has_gym_access":False,"home_equipment":"none","experience_level":"beginner","injuries_or_limitations":"lesion de hombro derecho, tendinitis supraespinoso, evitar ejercicios por encima de la cabeza"},
        "nutrition": {"diet_type":"vegan","meals_per_day_preferred":3},
        "health": {"conditions":["diabetes_tipo_2","shoulder_tendinitis"]},
        "motivation": {"main_motivation":"health","tracking_preference":"basic"}
    }
}

results = {}
for n, p in profiles.items():
    print(f"Ejecutando CP-{n:02d}...", flush=True)
    token = get_token(n)
    if not token:
        results[n] = {"error": "NO_TOKEN"}
        print(f"  ERROR: no token for CP-{n:02d}")
        continue
    # Complete onboarding (may fail if already completed — that's OK)
    complete_onboarding(
        token, p["profile"], p["lifestyle"], p["training"],
        p["nutrition"], p["health"], p["motivation"]
    )
    # Always fetch the plan from /plans to get full data including meals and sessions
    plan_r = api("GET", "/plans", token=token)
    plan = (plan_r.get("data") or {}).get("plan") if plan_r and plan_r.get("success") else None

    sessions = plan.get("training_sessions", []) if plan else []
    meals = plan.get("meals", []) if plan else []
    # Get meals for a single day (first 3-5 meals, grouped by scheduled_date)
    if meals:
        first_date = meals[0].get("scheduled_date", "")[:10]
        day1_meals = [m for m in meals if m.get("scheduled_date", "")[:10] == first_date]
    else:
        day1_meals = []
    cals = sum(m.get("calories", 0) for m in day1_meals)
    protein = sum(float(m.get("protein_g") or 0) for m in day1_meals)
    carbs = sum(float(m.get("carbs_g") or 0) for m in day1_meals)
    fat = sum(float(m.get("fat_g") or 0) for m in day1_meals)
    sessions_per_week = len(sessions) // 4 if sessions else 0
    results[n] = {
        "ok": plan_r.get("success", False) if plan_r else False,
        "ai": plan.get("generated_by_ai", False) if plan else False,
        "model": plan.get("ai_model_version", "?") if plan else "?",
        "cals": cals,
        "protein": round(protein, 1),
        "carbs": round(carbs, 1),
        "fat": round(fat, 1),
        "sessions_wk": sessions_per_week,
        "sessions_total": len(sessions),
        "day1_meals_count": len(day1_meals)
    }
    print(f"  CP-{n:02d}: ok={results[n]['ok']} cals={cals} protein={round(protein,1)}g carbs={round(carbs,1)}g sessions={sessions_per_week}/wk model={results[n]['model']}", flush=True)

print("\n=== RESULTADOS JSON ===")
print(json.dumps(results, indent=2))
