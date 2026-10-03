package com.stilllight.moonrise;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.os.vibrator.VibratorEnvelopeEffectInfo;
import android.provider.Settings;
import android.view.View;

import androidx.core.view.HapticFeedbackConstantsCompat;
import androidx.core.view.ViewCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "StilllightHaptics")
public class StilllightHapticsPlugin extends Plugin {
    private Vibrator vibrator;

    @Override
    public void load() {
        vibrator = resolveVibrator();
    }

    @PluginMethod
    public void perform(PluginCall call) {
        final String kind = call.getString("kind", "uiClick");
        getActivity().runOnUiThread(() -> {
            performKind(kind);
            call.resolve();
        });
    }

    private Vibrator resolveVibrator() {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager != null ? manager.getDefaultVibrator() : null;
        }
        return (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
    }

    private boolean systemHapticsEnabled() {
        try {
            return Settings.System.getInt(
                    getContext().getContentResolver(),
                    Settings.System.HAPTIC_FEEDBACK_ENABLED,
                    1) != 0;
        } catch (Exception ignored) {
            return true;
        }
    }

    private View hapticView() {
        if (getBridge() != null && getBridge().getWebView() != null) return getBridge().getWebView();
        return getActivity().getWindow().getDecorView();
    }

    private void semantic(int feedbackConstant) {
        View view = hapticView();
        if (view != null) ViewCompat.performHapticFeedback(view, feedbackConstant);
    }

    private void performKind(String kind) {
        if (!systemHapticsEnabled()) return;
        switch (kind) {
            case "select":
                semantic(HapticFeedbackConstantsCompat.SEGMENT_FREQUENT_TICK);
                break;
            case "toggleOn":
                semantic(HapticFeedbackConstantsCompat.TOGGLE_ON);
                break;
            case "toggleOff":
                semantic(HapticFeedbackConstantsCompat.TOGGLE_OFF);
                break;
            case "reject":
                semantic(HapticFeedbackConstantsCompat.REJECT);
                break;
            case "glassComplete":
                semantic(HapticFeedbackConstantsCompat.CONFIRM);
                break;
            case "pourContact":
                performPourContact();
                break;
            case "levelComplete":
                performLevelComplete();
                break;
            case "uiClick":
            default:
                semantic(HapticFeedbackConstantsCompat.CONTEXT_CLICK);
                break;
        }
    }

    private void vibrate(VibrationEffect effect) {
        if (vibrator == null || !vibrator.hasVibrator()) return;
        vibrator.vibrate(effect);
    }

    private void performPourContact() {
        if (vibrator != null && vibrator.hasVibrator() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_LOW_TICK)) {
                vibrate(VibrationEffect.startComposition()
                        .addPrimitive(VibrationEffect.Composition.PRIMITIVE_LOW_TICK, 0.42f)
                        .compose());
                return;
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && vibrator != null && vibrator.hasVibrator()) {
            vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK));
            return;
        }
        semantic(HapticFeedbackConstantsCompat.CLOCK_TICK);
    }

    private void performLevelComplete() {
        if (vibrator != null && vibrator.hasVibrator() && Build.VERSION.SDK_INT >= 36 && vibrator.areEnvelopeEffectsSupported()) {
            try {
                VibratorEnvelopeEffectInfo info = vibrator.getEnvelopeEffectInfo();
                long d = info == null ? 20L : Math.max(20L, info.getMinControlPointDurationMillis());
                VibrationEffect effect = new VibrationEffect.BasicEnvelopeBuilder()
                        .setInitialSharpness(0.58f)
                        .addControlPoint(0.20f, 0.62f, d)
                        .addControlPoint(0.05f, 0.72f, d)
                        .addControlPoint(0.58f, 0.90f, d * 2)
                        .addControlPoint(0.0f, 0.72f, d)
                        .build();
                vibrate(effect);
                return;
            } catch (RuntimeException ignored) {
                // Some OEM implementations report envelope support more generously than
                // they can actually play. Continue through the capability ladder.
            }
        }

        if (vibrator != null && vibrator.hasVibrator() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                && vibrator.areAllPrimitivesSupported(
                        VibrationEffect.Composition.PRIMITIVE_LOW_TICK,
                        VibrationEffect.Composition.PRIMITIVE_CLICK)) {
            vibrate(VibrationEffect.startComposition()
                    .addPrimitive(VibrationEffect.Composition.PRIMITIVE_LOW_TICK, 0.34f)
                    .addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, 0.72f, 46)
                    .compose());
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && vibrator != null && vibrator.hasVibrator()) {
            vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK));
            return;
        }
        semantic(HapticFeedbackConstantsCompat.CONFIRM);
    }
}
