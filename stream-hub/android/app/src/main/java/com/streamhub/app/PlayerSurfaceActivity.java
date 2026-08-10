package com.streamhub.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;

/**
 * MAX-branded full-screen player surface for direct streams.
 * User sees only our controls — not third-party OTT UI.
 */
public class PlayerSurfaceActivity extends AppCompatActivity {

    public static final String EXTRA_URL = "url";
    public static final String EXTRA_TITLE = "title";

    private PlaybackForegroundService playbackService;
    private boolean serviceBound = false;
    private PlayerView playerView;
    private TextView titleView;

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            PlaybackForegroundService.LocalBinder binder =
                (PlaybackForegroundService.LocalBinder) service;
            playbackService = binder.getService();
            serviceBound = true;
            attachPlayer();
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            playbackService = null;
            serviceBound = false;
        }
    };

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setContentView(buildLayout());

        String url = getIntent().getStringExtra(EXTRA_URL);
        String title = getIntent().getStringExtra(EXTRA_TITLE);
        if (title != null) titleView.setText(title);

        Intent serviceIntent = new Intent(this, PlaybackForegroundService.class);
        serviceIntent.setAction(PlaybackForegroundService.ACTION_START);
        serviceIntent.putExtra(PlaybackForegroundService.EXTRA_URL, url);
        serviceIntent.putExtra(PlaybackForegroundService.EXTRA_TITLE, title);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
        bindService(serviceIntent, connection, Context.BIND_AUTO_CREATE);
    }

    private View buildLayout() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        root.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        playerView = new PlayerView(this);
        playerView.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        playerView.setUseController(false);
        root.addView(playerView);

        LinearLayout chrome = new LinearLayout(this);
        chrome.setOrientation(LinearLayout.VERTICAL);
        chrome.setBackgroundColor(0x99000000);
        FrameLayout.LayoutParams chromeLp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        chromeLp.gravity = Gravity.TOP;
        chrome.setLayoutParams(chromeLp);
        chrome.setPadding(32, 32, 32, 24);

        LinearLayout topRow = new LinearLayout(this);
        topRow.setOrientation(LinearLayout.HORIZONTAL);
        topRow.setGravity(Gravity.CENTER_VERTICAL);

        ImageButton back = new ImageButton(this);
        back.setImageResource(android.R.drawable.ic_media_previous);
        back.setBackgroundColor(Color.TRANSPARENT);
        back.setColorFilter(Color.WHITE);
        back.setOnClickListener(v -> finishPlayback());

        titleView = new TextView(this);
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(18f);
        titleView.setPadding(24, 0, 0, 0);
        titleView.setText("MAX MEDIA PLAYER");

        topRow.addView(back);
        topRow.addView(titleView);
        chrome.addView(topRow);
        root.addView(chrome);

        return root;
    }

    private void attachPlayer() {
        if (playbackService == null || playerView == null) return;
        ExoPlayer player = playbackService.getPlayer();
        playerView.setPlayer(player);
    }

    private void finishPlayback() {
        if (serviceBound) {
            unbindService(connection);
            serviceBound = false;
        }
        Intent stop = new Intent(this, PlaybackForegroundService.class);
        stop.setAction(PlaybackForegroundService.ACTION_STOP);
        startService(stop);
        finish();
    }

    @Override
    protected void onDestroy() {
        if (serviceBound) {
            unbindService(connection);
            serviceBound = false;
        }
        if (playerView != null) {
            playerView.setPlayer(null);
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        finishPlayback();
    }
}
