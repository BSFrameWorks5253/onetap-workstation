package com.onetap.studiotracker.ui.screens.dashboard

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.onetap.studiotracker.data.models.SafarCampaign
import com.onetap.studiotracker.data.models.StudioStats
import com.onetap.studiotracker.data.repository.SafarRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class BriefingMode {
    TEXT,
    IMAGE
}

class DashboardViewModel : ViewModel() {

    private val repository: SafarRepository = SafarRepository.getInstance()

    val campaigns: StateFlow<List<SafarCampaign>> = repository.campaigns

    val activeCampaign: StateFlow<SafarCampaign?> = repository.campaigns.map { list ->
        list.firstOrNull { it.isOngoing } ?: list.firstOrNull()
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val stats: StateFlow<StudioStats> = repository.campaigns.map {
        StudioStats.calculate(it)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), StudioStats())

    val syncState = repository.syncState

    fun triggerManualSync() {
        viewModelScope.launch {
            repository.triggerCloudSync()
        }
    }

    private val _isBriefingSheetOpen = MutableStateFlow(false)
    val isBriefingSheetOpen: StateFlow<Boolean> = _isBriefingSheetOpen.asStateFlow()

    private val _selectedBriefingCampaign = MutableStateFlow<SafarCampaign?>(null)
    val selectedBriefingCampaign: StateFlow<SafarCampaign?> = _selectedBriefingCampaign.asStateFlow()

    private val _briefingMode = MutableStateFlow(BriefingMode.IMAGE)
    val briefingMode: StateFlow<BriefingMode> = _briefingMode.asStateFlow()

    fun openBriefing(campaign: SafarCampaign) {
        _selectedBriefingCampaign.value = campaign
        _isBriefingSheetOpen.value = true
    }

    fun closeBriefing() {
        _isBriefingSheetOpen.value = false
    }

    fun setBriefingMode(mode: BriefingMode) {
        _briefingMode.value = mode
    }

    fun setActiveCampaign(campaignId: String) {
        repository.setActiveCampaign(campaignId)
    }

    fun copyStatus(context: Context, campaign: SafarCampaign) {
        val text = repository.generateWhatsAppBriefingText(campaign)
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("One Tap Safar Status", text)
        clipboard.setPrimaryClip(clip)
        Toast.makeText(context, "Safar briefing copied to clipboard!", Toast.LENGTH_SHORT).show()
    }
}
