<script context="module">
	export const prerender = true;
</script>

<script>
	import { onMount } from 'svelte';

	// const BASE_URL = 'http://localhost:8999';
	const BASE_URL = 'http://quanye.org:8999';

	let Mim = null;
	let tim = null;

	let cloudAccounts = [];
	let account = '';
	let password = '';
	let currentCloudAccount = {};
	let currentCloudGroups = [];

	let groups = [];
	let members = [];
	let group = '';
	let user1 = '';
	let user2 = '';
	let delayStart = 0;
	let delayEnd = 0;
	let enabled = true;
	let mMsgs = '';
	let isLogin = false;
	let connectState = 'disconnected';

	function containGroupId(groupId) {
		return (
			currentCloudGroups.filter((g) => {
				if (g['group-id'] == groupId) {
					return true;
				}
			}).length > 0
		);
	}

	onMount(async () => {
		const mim = await import('../lib/mim.js');
		Mim = mim;
		tim = mim.getTim();
		// load account data
		loadCloudAccounts();
	});

	function onLoginHandler(evt) {
		fetch(`${BASE_URL}/api/do-login/${account}/${password}`)
			.then((res) => {
				return res.json();
			})
			.then((res) => {
				if (res.code == 200) {
					tim
						.login({
							userID: res.data.userid,
							userSig: res.data.token
						})
						.then((res) => {
							if (res.data.errorCode == 0) {
								// 登录成功
								if (res.data.repeatLogin === true) {
									// 重复登录
									alert('请勿重复登录');
								}
								tim.on(Mim.getTIM().EVENT.SDK_READY, onSdkReady);
							} else {
								console.error('login error: ', res.data.errorInfo);
							}
						})
						.catch((err) => {
							console.error('login error: ', err.message);
						});
				} else {
					alert(res.msg);
				}
			})
			.catch((err) => {
				alert(err.message);
			});
	}

	function onAccountDeleteHandler(evt) {}

	function onSdkReady(_evt) {
		isLogin = true;
		connectState = 'connected';
		// get group list
		getGroupList();
		// listen new message
		tim.on(Mim.getTIM().EVENT.MESSAGE_RECEIVED, (evt) => {
			if (evt.data != null && evt.data.length >= 1) {
				const msg = evt.data[0];
				const senderUserId = msg.from;
				const groupId = msg.to;
				const textMsg = msg.payload.text;
				if (textMsg != undefined && textMsg != null) {
					for (const group of currentCloudGroups) {
						const msgs = group.msgs.split('|');
						let line = null;
						if (msgs.length >= 2 && textMsg.includes(msgs[0])) {
							line = msgs;
						}
						let flag;
						if (
							(group['user-id1'] == null || group['user-id1'] == '') &&
							(group['user-id2'] == null || group['user-id2'] == '')
						) {
							flag = true;
						} else {
							if (group['user-id1'] == senderUserId || group['user-id2'] == senderUserId) {
								flag = true;
							} else {
								flag = false;
							}
						}
						if (flag && groupId == group['group-id'] && line != null && group['enabled']) {
							const delay = delayStart + Math.round(Math.random() * (delayEnd - delayStart));
							let index = Math.round(Math.random() * (line.length - 2)) + 1;
							setTimeout(() => {
								const message = tim.createTextMessage({
									to: groupId,
									conversationType: Mim.getTIM().TYPES.CONV_GROUP,
									priority: Mim.getTIM().TYPES.MSG_PRIORITY_HIGH,
									payload: {
										text: line[index]
									}
								});
								tim
									.sendMessage(message)
									.then((res) => {
										// sending successful
									})
									.catch((err) => {
										// sending take error
									});
							}, delay * 1000);
							break;
						}
					}
				}
			}
		});
		// listen on net-state-changed
		tim.on(Mim.getTIM().EVENT.NET_STATE_CHANGE, (evt) => {
			const types = Mim.getTIM().TYPES;
			if (types.NET_STATE_CONNECTED == evt.data.state) {
				// 已连接
				connectState = 'connected';
			} else if (types.NET_STATE_CONNECTING == evt.data.state) {
				// 连接中
				connectState = 'connecting';
			} else if (types.NET_STATE_DISCONNECTED == evt.data.state) {
				// 未连接
				connectState = 'disconnected';
			}
		});
	}

	function getGroupList() {
		tim
			.getGroupList()
			.then((res) => {
				if (res.code == 0) {
					groups = res.data.groupList;
					// group = '';
					// load currentCloudGroups
					loadCloudGroups();
				}
			})
			.catch((err) => {
				alert('获取群组失败，请重试:', err.message);
			});
	}

	function onGroupsSelectedHandle(evt, offset = 0) {
		if (!group.includes('λ')) {
			return;
		}
		const groupId = group.split('λ')[1];
		tim
			.getGroupMemberList({ groupID: groupId, count: 100, offset: offset })
			.then((res) => {
				if (res.code == 0) {
					console.log('member-data', res.data);
					if (members.length > 0 && offset == 0) {
						members = [];
					}
					if (res.data.offset != 0) {
						members = members.concat(
							res.data.memberList.filter((val) => {
								return val['role'] == 'Admin' || val['role'] == 'Owner';
							})
						);
						onGroupsSelectedHandle(evt, offset + 100);
					} else {
						const groupName = group.split('λ')[0];
						const groupId = group.split('λ')[1];
						const currentGroup = currentCloudGroups.find((val) => {
							if (val['group-id'] == groupId) {
								return true;
							}
						});
						if (currentGroup != undefined) {
							console.log(currentGroup);
							if (currentGroup['user-name1'] != null || currentGroup['user-name1'] != '') {
								user1 = `${currentGroup['user-name1']}λ${currentGroup['user-id1']}`;
							}
							if (currentGroup['user-name2'] != null || currentGroup['user-name2'] != '') {
								user2 = `${currentGroup['user-name2']}λ${currentGroup['user-id2']}`;
							}
							delayStart = currentGroup['delay-start'];
							delayEnd = currentGroup['delay-end'];
							enabled = currentGroup['enabled'];
							mMsgs = currentGroup['msgs'];
						} else {
							user1 = '';
							user2 = '';
							delayStart = 0;
							delayEnd = 0;
							enabled = true;
							mMsgs = '';
						}
					}
				}
			})
			.catch((err) => {
				alert('获取群成员失败，请重试:', err.message);
			});
	}
	function onDelayInputHandle(evt) {
		if (delayStart < 0) {
			delayStart = 0;
		}
		if (delayEnd < 0) {
			delayEnd = 0;
		}
	}

	function onSaveAccountToCloudHandler(evt) {
		fetch(`${BASE_URL}/api/save-account/${account}/${password}`)
			.then((res) => {
				return res.json();
			})
			.then((res) => {
				if (res.code == 200) {
					loadCloudAccounts();
					alert('保存账号成功');
				} else {
					alert('保存账号失败: ${res.msg}');
				}
			})
			.catch((err) => {
				alert('保存账号失败');
			});
	}

	function onSaveGroupHandler(evt) {
		const groupId = group.split('λ')[1];
		const groupName = group.split('λ')[0];
		const userName1 = user1.split('λ')[0];
		const userId1 = user1.split('λ')[1];
		const userName2 = user2.split('λ')[0];
		const userId2 = user2.split('λ')[1];
		const nowGroup = {
			account: account,
			'group-id': groupId,
			'group-name': groupName,
			'user-name1': userName1,
			'user-id1': userId1,
			'user-name2': userName2,
			'user-id2': userId2,
			'delay-start': delayStart,
			'delay-end': delayEnd,
			enabled: enabled,
			msgs: mMsgs
		};
		fetch(`${BASE_URL}/api/save-group`, {
			method: 'post',
			cache: 'no-cache',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(nowGroup)
		})
			.then((res) => {
				return res.json();
			})
			.then((res) => {
				if (res.code == 200) {
					loadCloudGroups();
					alert(`保存成功`);
				} else {
					alert(`保存失败:${res.msg}`);
				}
			})
			.catch((err) => {
				alert(`保存失败`);
			});
	}
	function onDeleteGroupHandler(evt) {
		fetch(`${BASE_URL}/api/delete-group/${account}/${encodeURIComponent(group.split('λ')[1])}`)
			.then((res) => {
				return res.json();
			})
			.then((res) => {
				if (res.code == 200) {
					loadCloudGroups(true);
					alert('删除群组成功');
				} else {
					alert(`删除群组失败：${res.msg}`);
				}
			})
			.catch((err) => {
				alert('删除群组失败');
			});
	}

	function loadCloudGroups(reload = false) {
		fetch(`${BASE_URL}/api/get-groups-by-account/${account}`)
			.then((res) => {
				return res.json();
			})
			.then((res) => {
				if (res.code == 200) {
					currentCloudGroups = res.groups;
					if (currentCloudGroups.length > 0) {
						if (group == '' || reload) {
							const firstGroup = currentCloudGroups[0];
							group = `${firstGroup['group-name']}λ${firstGroup['group-id']}`;
						}
					} else {
						group = '';
					}
					console.log(currentCloudGroups);
				}
			})
			.catch((err) => {
				alert('获取云端群组失败');
			});
	}
	function loadCloudAccounts() {
		fetch(`${BASE_URL}/api/get-accounts-all`, {
			method: 'get'
		})
			.then((res) => {
				return res.json();
			})
			.then((res) => {
				if (res.code == 200) {
					cloudAccounts = res.accounts;
				}
			});
	}
	function onAccountInputHandler(evt) {
		fetch(`${BASE_URL}/api/get-account/${account}`)
			.then((res) => {
				return res.json();
			})
			.then((res) => {
				if (res.code == 200) {
					password = res.password;
				} else {
					password = '';
				}
			})
			.catch((err) => {
				password = '';
			});
	}

	$: if (account) {
		onAccountInputHandler(null);
	}
	$: if (group) {
		onGroupsSelectedHandle(null);
	}
</script>

<svelte:head>
	<title>聊聊看吧自动回复</title>
	<meta name="description" content="llkb" />
</svelte:head>

云端账号：
<select name="cloudAccounts" id="cloudAccounts" bind:value={account}>
	{#if cloudAccounts.length == 0}
		<option value="">加载中...</option>
	{:else}
		<option value="">下拉选择云端账号</option>
	{/if}
	{#each cloudAccounts as { account, password }}
		<option value={account}>{account}</option>
	{/each}
</select>
<br />

<form action="#">
	<label for="phoneNumber">
		<span>帐号：</span>
		<input
			type="text"
			name="phoneNumber"
			id="phoneNumber"
			bind:value={account}
			on:input={onAccountInputHandler}
		/>
		{#if isLogin}
			<span>已登录</span>
		{:else}
			<span>未登录</span>
		{/if}
		{#if connectState == 'disconnected'}
			<span>未连接</span>
		{:else if connectState == 'connecting'}
			<span>连接中...</span>
		{:else if connectState == 'connected'}
			<span>已连接</span>
		{/if}
	</label>
	<br />
	<label for="password">
		<span>密码：</span>
		<input type="text" name="password" id="password" bind:value={password} />
	</label>
	<br />
	<input type="button" value="登录" on:click|preventDefault={onLoginHandler} />
	<input type="button" value="保存账号" on:click|preventDefault={onSaveAccountToCloudHandler} />
	<input type="button" value="删除帐号" on:click|preventDefault={onAccountDeleteHandler} />
</form>

<hr />

群组名：
<select name="groups" id="groups" bind:value={group} on:change={onGroupsSelectedHandle}>
	{#if groups.length == 0}
		<option value="">请先登录</option>
	{:else}
		<option value="">下拉选择群名</option>
	{/if}
	{#each groups as { groupID, name }}
		<option value="{name}λ{groupID}">{name}</option>
	{/each}
</select>
<button on:click|preventDefault={(_evt) => getGroupList()}>刷新</button>
<button on:click|preventDefault={onSaveGroupHandler}>保存群组</button>
<button on:click|preventDefault={onDeleteGroupHandler}>删除群组</button>
<br />
用户名1：
<select name="members1" id="members1" bind:value={user1}>
	{#if members.length == 0}
		<option value="">请先选择群组</option>
	{:else}
		<option value="">下拉选择群组</option>
	{/if}
	{#each members as { userID, nick }}
		<option value="{nick}λ{userID}">{nick}</option>
	{/each}
</select>
<button on:click={(evt) => (user1 = '')}>清空</button>
<br />
用户名2：
<select name="members1" id="members1" bind:value={user2}>
	{#if members.length == 0}
		<option value="">请先选择群组</option>
	{:else}
		<option value="">下拉选择群组</option>
	{/if}
	{#each members as { userID, nick }}
		<option value="{nick}λ{userID}">{nick}</option>
	{/each}
</select>
<button on:click={(evt) => (user2 = '')}>清空</button>
<br />
延迟秒：
<input
	type="number"
	name="delayStart"
	id="delayStart"
	bind:value={delayStart}
	on:input={onDelayInputHandle}
/>
-
<input
	type="number"
	name="delayEnd"
	id="delayEnd"
	bind:value={delayEnd}
	on:input={onDelayInputHandle}
/>
<br />
<label for="enable">
	<input type="checkbox" name="enable" id="enable" bind:checked={enabled} />
	启用
</label>
<br />
<label for="msgs">
	消息内容：
	<br />
	<textarea name="msgs" id="msgs" cols="30" rows="10" bind:value={mMsgs} />
</label>
<br />

<style>
	input[type='number'] {
		width: 50px;
	}
</style>
