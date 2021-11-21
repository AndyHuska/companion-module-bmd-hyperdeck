const Timecode = require('smpte-timecode')
const { VideoFormat } = require('hyperdeck-connection')

const frameRates = {
	[VideoFormat.NTSC]: 29.97,
	[VideoFormat.PAL]: 25,
	[VideoFormat.NTSCp]: 29.97,
	[VideoFormat.PALp]: 25,
	[VideoFormat._720p50]: 50,
	[VideoFormat._720p5994]: 59.94,
	[VideoFormat._720p60]: 60,
	// [VideoFormat._1080p23976]: 23.976, // not supported by smpte-timecode lib
	[VideoFormat._1080p24]: 24,
	[VideoFormat._1080p25]: 25,
	[VideoFormat._1080p2997]: 29.97,
	[VideoFormat._1080p30]: 30,
	[VideoFormat._1080i50]: 25,
	[VideoFormat._1080i5994]: 29.97,
	[VideoFormat._1080i60]: 30,
	[VideoFormat._1080p50]: 50,
	[VideoFormat._1080p5994]: 59.94,
	[VideoFormat._1080p60]: 60,
	// [VideoFormat._4Kp23976]: 23.976, // not supported by smpte-timecode lib
	[VideoFormat._4Kp24]: 24,
	[VideoFormat._4Kp25]: 25,
	[VideoFormat._4Kp2997]: 29.97,
	[VideoFormat._4Kp30]: 30,
	[VideoFormat._4Kp50]: 50,
	[VideoFormat._4Kp5994]: 59.94,
	[VideoFormat._4Kp60]: 60,
}

module.exports.updateTransportInfoVariables = function (instance) {
	const capitalise = (s) => {
		if (typeof s !== 'string') return ''
		return s.charAt(0).toUpperCase() + s.slice(1)
	}
	instance.setVariable('status', capitalise(instance.transportInfo['status']))
	instance.setVariable('speed', instance.transportInfo['speed'])

	//Clip ID and Slot ID  null exceptions
	let clipIdVariable = '—'
	if (instance.transportInfo['clipId'] != null) {
		clipIdVariable = instance.transportInfo['clipId']
	}

	let slotIdVariable = '—'
	if (instance.transportInfo['slotId'] != null) {
		slotIdVariable = instance.transportInfo['slotId']
	}
	instance.setVariable('clipId', clipIdVariable)
	instance.setVariable('slotId', slotIdVariable)
	instance.setVariable('videoFormat', instance.transportInfo['videoFormat'])
}

module.exports.updateClipVariables = function (instance) {
	instance.setVariable('clipCount', instance.clipCount)
}

module.exports.updateSlotInfoVariables = function (instance) {
	let recordingTimes = []
	if (instance.slotInfo[1] != null) {
		recordingTimes[1] = new Date(instance.slotInfo[1]['recordingTime'] * 1000).toISOString().substr(11, 8)
		instance.setVariable('slot1_recordingTime', recordingTimes[1])
	}
	if (instance.slotInfo[2] != null) {
		recordingTimes[2] = new Date(instance.slotInfo[2]['recordingTime'] * 1000).toISOString().substr(11, 8)
		instance.setVariable('slot2_recordingTime', recordingTimes[2])
	}
	let activeSlot = instance.transportInfo['slotId']
	if (instance.slotInfo[activeSlot] != null) {
		instance.setVariable('recordingTime', recordingTimes[activeSlot])
	}
}

module.exports.updateTimecodeVariables = function (instance) {
	const tb = frameRates[instance.transportInfo['videoFormat']]
	const countUp = {
		tcH: '--',
		tcM: '--',
		tcS: '--',
		tcF: '--',
		tcHMS: '--:--:--',
		tcHMSF: '--:--:--:--',
	}
	let countDown = {
		tcH: '--',
		tcM: '--',
		tcS: '--',
		tcF: '--',
		tcHMS: '--:--:--',
		tcHMSF: '--:--:--:--',
	}

	const pad = (n) => ('00' + n).substr(-2)

	const setTcVariable = (isCountdown, { tcH, tcM, tcS, tcF, tcHMS, tcHMSF }) => {
		instance.setVariable((isCountdown ? 'countdownT' : 't') + 'imecodeHMS', tcHMS)
		instance.setVariable((isCountdown ? 'countdownT' : 't') + 'imecodeHMSF', tcHMSF)
		instance.setVariable((isCountdown ? 'countdownT' : 't') + 'imecodeH', pad(tcH))
		instance.setVariable((isCountdown ? 'countdownT' : 't') + 'imecodeM', pad(tcM))
		instance.setVariable((isCountdown ? 'countdownT' : 't') + 'imecodeS', pad(tcS))
		instance.setVariable((isCountdown ? 'countdownT' : 't') + 'imecodeF', pad(tcF))
	}

	if (instance.transportInfo['displayTimecode']) {
		if (tb) {
			try {
				let tc = Timecode(instance.transportInfo['displayTimecode'], tb)
				countUp.tcH = tc.hours
				countUp.tcM = tc.minutes
				countUp.tcS = tc.seconds
				countUp.tcF = tc.frames
				countUp.tcHMS = tc.toString().substr(0, 8)
				countUp.tcHMSF = tc.toString()

				if (
					instance.transportInfo['slotId'] !== undefined &&
					instance.clipsList[instance.transportInfo['slotId']] !== undefined
				) {
					const clip = instance.clipsList[instance.transportInfo['slotId']].find(
						({ clipId }) => clipId == instance.transportInfo['clipId']
					)
					if (clip && clip.duration) {
						const tcTot = Timecode(clip.duration, tb)
						const tcStart = Timecode(clip.startTime, tb)
						const left = Math.max(0, tcTot.frameCount - (tc.frameCount - tcStart.frameCount) - 1)
						const tcLeft = Timecode(left, tb) // todo - unhardcode
	
						countDown.tcH = tcLeft.hours
						countDown.tcM = tcLeft.minutes
						countDown.tcS = tcLeft.seconds
						countDown.tcF = tcLeft.frames
						countDown.tcHMS = tcLeft.toString().substr(0, 8)
						countDown.tcHMSF = tcLeft.toString()
					}
				}
			} catch (err) {
				this.log('error', 'Timecode error:' + JSON.stringify(err))
			}
		} else {
			// no timebase implies we can't use smpte-timecode lib
			let tc = instance.transportInfo['displayTimecode'].match(
				/^(?<HMS>(?<H>\d{2}):(?<M>\d{2}):(?<S>\d{2}))[:;](?<F>\d{2})$/
			)
			if (tc && tc.groups) {
				countUp.tcH = tc.groups.H
				countUp.tcM = tc.groups.M
				countUp.tcS = tc.groups.S
				countUp.tcF = tc.groups.F
				countUp.tcHMS = tc.groups.HMS
			}
			countUp.tcHMSF = instance.transportInfo['displayTimecode']
		}
	}

	setTcVariable(false, countUp), setTcVariable(true, countDown)
}

module.exports.updateInPointVariable = function (instance) {
	try	{
		instance.setVariable('InPointHMSF', instance.timecodeVariables['TimecodeHMSF'])
	}
	catch(e)
	{

	}
}

module.exports.updateOutPointVariable = function (instance) {
	try {
		instance.setVariable('OutPointHMSF', instance.timecodeVariables['TimecodeHMSF'])
	}
	catch(e)
	{

	}
}

module.exports.initVariables = function (instance) {
	var variables = []

	// transport info vars:
	variables.push({
		label: 'Transport status',
		name: 'status',
	})
	variables.push({
		label: 'Play speed',
		name: 'speed',
	})
	variables.push({
		label: 'Clip ID',
		name: 'clipId',
	})
	variables.push({
		label: 'Slot ID',
		name: 'slotId',
	})
	variables.push({
		label: 'Video format',
		name: 'videoFormat',
	})
	variables.push({
		label: 'Active slot recording time available',
		name: 'recordingTime',
	})
	variables.push({
		label: 'Slot 1 recording time available',
		name: 'slot1_recordingTime',
	})
	variables.push({
		label: 'Slot 2 recording time available',
		name: 'slot2_recordingTime',
	})
	module.exports.updateTransportInfoVariables(instance)
	module.exports.updateSlotInfoVariables(instance)

	// Clip variables
	variables.push({
		label: 'Clip count',
		name: 'clipCount'
	})
	module.exports.updateClipVariables(instance)

	// Timecode variables
	const initTcVariable = (isCountdown) => {
		variables.push({
			label: (isCountdown ? 'Countdown ' : '') + 'Timecode (HH:MM:SS)',
			name: (isCountdown ? 'countdownT' : 't') + 'imecodeHMS',
		})

		variables.push({
			label: (isCountdown ? 'Countdown ' : '') + 'Timecode (HH:MM:SS:FF)',
			name: (isCountdown ? 'countdownT' : 't') + 'imecodeHMSF',
		})

		variables.push({
			label: (isCountdown ? 'Countdown ' : '') + 'Timecode (HH)',
			name: (isCountdown ? 'countdownT' : 't') + 'imecodeH',
		})

		variables.push({
			label: (isCountdown ? 'Countdown ' : '') + 'Timecode (MM)',
			name: (isCountdown ? 'countdownT' : 't') + 'imecodeM',
		})

		variables.push({
			label: (isCountdown ? 'Countdown ' : '') + 'Timecode (SS)',
			name: (isCountdown ? 'countdownT' : 't') + 'imecodeS',
		})

		variables.push({
			label: (isCountdown ? 'Countdown ' : '') + 'Timecode (FF)',
			name: (isCountdown ? 'countdownT' : 't') + 'imecodeF',
		})
	}

	initTcVariable(false)
	initTcVariable(true)

	variables.push({
		label: 'InPointHMSF',
		name: 'InPointHMSF',
	})
	

	variables.push({
		label: 'OutPointHMSF',
		name: 'OutPointHMSF',
	})

	instance.setVariableDefinitions(variables)
	

	module.exports.updateTimecodeVariables(instance)

	module.exports.updateInPointVariable(instance)

	module.exports.updateOutPointVariable(instance)

	
}
