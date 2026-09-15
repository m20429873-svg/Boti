require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType
} = require("@discordjs/voice");

const ffmpegPath = require("ffmpeg-static");
const { spawn } = require("child_process");
const fs = require("fs");

// =====================================================
// TOKEN
// =====================================================

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("❌ TOKEN غير موجود في Railway Variables");
  process.exit(1);
}

// =====================================================
// السيرفر
// =====================================================

const SERVER_NAME = "Velora ✔";
const SERVER_IP = "VELORA010.aternos.me:51685";

// =====================================================
// بث القرآن
// =====================================================

const QURAN_RADIO_URL =
  "https://backup.qurango.net/radio/salma";

// =====================================================
// رتب الإدارة
// =====================================================

const STAFF_ROLES = [
  "Trial",
  "Helper",
  "Sr Helper",
  "Mod",
  "Sr Mod",
  "Jr Admin",
  "Admin",
  "Co Owner",
  "Hp Owner",
  "Owner"
];

const SENIOR_STAFF_ROLES = [
  "Sr Mod",
  "Jr Admin",
  "Admin",
  "Co Owner",
  "Hp Owner",
  "Owner"
];

// =====================================================
// البيانات
// =====================================================

const DATA_FILE = "./data.json";

let data = {
  guilds: {}
};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );
  } catch {
    console.error("⚠️ data.json غير صالح.");
    data = { guilds: {} };
  }
}

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2)
    );
  } catch (error) {
    console.error(
      "❌ خطأ حفظ البيانات:",
      error
    );
  }
}

function getGuildData(guildId) {
  if (!data.guilds[guildId]) {
    data.guilds[guildId] = {
      points: {},
      salary: {},
      tickets: {},
      warns: {}
    };
  }

  const guildData =
    data.guilds[guildId];

  guildData.points ||= {};
  guildData.salary ||= {};
  guildData.tickets ||= {};
  guildData.warns ||= {};

  return guildData;
}

// =====================================================
// البوت
// =====================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// =====================================================
// Voice
// =====================================================

const voiceData = new Map();

function stopQuran(guildId) {
  const info =
    voiceData.get(guildId);

  if (!info) return false;

  try {
    info.player.stop();
  } catch {}

  try {
    info.ffmpeg.kill();
  } catch {}

  try {
    info.connection.destroy();
  } catch {}

  voiceData.delete(guildId);

  return true;
}

function playQuran(
  guild,
  voiceChannel
) {
  stopQuran(guild.id);

  const connection =
    joinVoiceChannel({
      channelId:
        voiceChannel.id,

      guildId:
        guild.id,

      adapterCreator:
        guild.voiceAdapterCreator,

      selfDeaf: true
    });

  const player =
    createAudioPlayer();

  const ffmpeg =
    spawn(
      ffmpegPath,
      [
        "-re",
        "-i",
        QURAN_RADIO_URL,
        "-f",
        "s16le",
        "-ar",
        "48000",
        "-ac",
        "2",
        "pipe:1"
      ],
      {
        stdio: [
          "ignore",
          "pipe",
          "ignore"
        ]
      }
    );

  const resource =
    createAudioResource(
      ffmpeg.stdout,
      {
        inputType:
          StreamType.Raw
      }
    );

  player.play(resource);

  connection.subscribe(
    player
  );

  voiceData.set(
    guild.id,
    {
      connection,
      player,
      ffmpeg,
      channelId:
        voiceChannel.id
    }
  );

  player.on(
    AudioPlayerStatus.Idle,
    () => {
      if (
        voiceData.has(
          guild.id
        )
      ) {
        try {
          player.play(
            resource
          );
        } catch {}
      }
    }
  );

  player.on(
    "error",
    error => {
      console.error(
        "❌ خطأ تشغيل القرآن:",
        error
      );
    }
  );

  connection.on(
    VoiceConnectionStatus.Disconnected,
    () => {
      if (
        voiceData.has(
          guild.id
        )
      ) {
        setTimeout(
          () => {
            if (
              voiceData.has(
                guild.id
              )
            ) {
              stopQuran(
                guild.id
              );
            }
          },
          5000
        );
      }
    }
  );

  ffmpeg.on(
    "error",
    error => {
      console.error(
        "❌ FFmpeg Error:",
        error
      );
    }
  );

  return true;
}

// =====================================================
// الرتب
// =====================================================

function hasRole(
  member,
  roleName
) {
  if (
    !member ||
    !member.roles
  ) {
    return false;
  }

  return member.roles.cache.some(
    role =>
      role.name.toLowerCase() ===
      roleName.toLowerCase()
  );
}

function isStaff(member) {
  return STAFF_ROLES.some(
    role =>
      hasRole(
        member,
        role
      )
  );
}

function isSeniorStaff(member) {
  return SENIOR_STAFF_ROLES.some(
    role =>
      hasRole(
        member,
        role
      )
  );
}

// =====================================================
// النقاط
// =====================================================

function getPoints(
  guildId,
  userId
) {
  const guildData =
    getGuildData(
      guildId
    );

  return Number(
    guildData.points[userId] || 0
  );
}

function addPoints(
  guildId,
  userId,
  amount
) {
  const guildData =
    getGuildData(
      guildId
    );

  const oldPoints =
    Number(
      guildData.points[userId] || 0
    );

  const newPoints =
    Math.max(
      0,
      oldPoints + amount
    );

  guildData.points[userId] =
    newPoints;

  saveData();

  return newPoints;
}

// =====================================================
// الأوامر
// =====================================================

const commands = [

  // ===================================================
  // /ip
  // ===================================================

  new SlashCommandBuilder()
    .setName("ip")
    .setDescription(
      "عرض IP السيرفر"
    ),

  // ===================================================
  // /points
  // ===================================================

  new SlashCommandBuilder()
    .setName("points")
    .setDescription(
      "عرض نقاطك"
    ),

  // ===================================================
  // /addpoints
  // ===================================================

  new SlashCommandBuilder()
    .setName("addpoints")
    .setDescription(
      "إضافة نقاط لعضو"
    )
    .addUserOption(
      option =>
        option
          .setName("member")
          .setDescription(
            "العضو"
          )
          .setRequired(true)
    )
    .addIntegerOption(
      option =>
        option
          .setName("amount")
          .setDescription(
            "عدد النقاط"
          )
          .setMinValue(1)
          .setRequired(true)
    ),

  // ===================================================
  // /minuspoints
  // ===================================================

  new SlashCommandBuilder()
    .setName("minuspoints")
    .setDescription(
      "خصم نقاط من عضو"
    )
    .addUserOption(
      option =>
        option
          .setName("member")
          .setDescription(
            "العضو"
          )
          .setRequired(true)
    )
    .addIntegerOption(
      option =>
        option
          .setName("amount")
          .setDescription(
            "عدد النقاط"
          )
          .setMinValue(1)
          .setRequired(true)
    ),

  // ===================================================
  // /salary
  // ===================================================

  new SlashCommandBuilder()
    .setName("salary")
    .setDescription(
      "استلام راتب الإدارة"
    ),

  // ===================================================
  // /claim
  // ===================================================

  new SlashCommandBuilder()
    .setName("claim")
    .setDescription(
      "استلام التكت"
    ),

  // ===================================================
  // /warn
  // ===================================================

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription(
      "تحذير عضو"
    )
    .addUserOption(
      option =>
        option
          .setName("member")
          .setDescription(
            "العضو"
          )
          .setRequired(true)
    )
    .addStringOption(
      option =>
        option
          .setName("reason")
          .setDescription(
            "سبب التحذير"
          )
          .setRequired(true)
    ),

  // ===================================================
  // /staffrequest
  // ===================================================

  new SlashCommandBuilder()
    .setName("staffrequest")
    .setDescription(
      "طلب حضور الإدارة"
    ),

  // ===================================================
  // /setup-ticket
  // ===================================================

  new SlashCommandBuilder()
    .setName("setup-ticket")
    .setDescription(
      "إنشاء لوحة التكت"
    ),

  // ===================================================
  // /quran
  // ===================================================

  new SlashCommandBuilder()
    .setName("quran")
    .setDescription(
      "تشغيل تلاوة القرآن في الروم الصوتي"
    ),

  // ===================================================
  // /quran-stop
  // ===================================================

  new SlashCommandBuilder()
    .setName("quran-stop")
    .setDescription(
      "إيقاف تلاوة القرآن وخروج البوت"
    )

].map(
  command =>
    command.toJSON()
);

// =====================================================
// تسجيل الأوامر
// =====================================================

async function registerCommands() {
  try {

    const rest =
      new REST({
        version: "10"
      }).setToken(
        TOKEN
      );

    console.log(
      "🔄 تسجيل أوامر Boti..."
    );

    await rest.put(
      Routes.applicationCommands(
        client.user.id
      ),
      {
        body: commands
      }
    );

    console.log(
      "✅ تم تسجيل الأوامر Global"
    );

  } catch (error) {

    console.error(
      "❌ خطأ تسجيل الأوامر:",
      error
    );

  }
}

// =====================================================
// تشغيل البوت
// =====================================================

client.once(
  "ready",
  async () => {

    console.log(
      "================================="
    );

    console.log(
      `✅ Boti Online: ${client.user.tag}`
    );

    console.log(
      `🌐 ${SERVER_NAME}`
    );

    console.log(
      `IP: ${SERVER_IP}`
    );

    console.log(
      "================================="
    );

    await registerCommands();

    client.user.setPresence({
      activities: [
        {
          name:
            `${SERVER_NAME} | /ip`,
          type: 0
        }
      ],
      status:
        "online"
    });

  }
);

// =====================================================
// منع الروابط + // + Anti Spam
// =====================================================

const lastMessage =
  new Map();

const LINK_REGEX =
  /(https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)/i;

client.on(
  "messageCreate",
  async message => {

    if (
      !message.guild ||
      message.author.bot
    ) {
      return;
    }

    const member =
      message.member;

    if (
      isStaff(member)
    ) {
      return;
    }

    // منع الروابط
    if (
      LINK_REGEX.test(
        message.content
      )
    ) {

      await message.delete()
        .catch(() => {});

      const warning =
        await message.channel
          .send({
            content:
              `🚫 <@${message.author.id}> ممنوع إرسال الروابط في السيرفر.`
          })
          .catch(
            () => null
          );

      if (warning) {

        setTimeout(
          () => {
            warning
              .delete()
              .catch(
                () => {}
              );
          },
          5000
        );

      }

      return;
    }

    // منع //
    if (
      message.content.includes(
        "//"
      )
    ) {

      await message.delete()
        .catch(() => {});

      const warning =
        await message.channel
          .send({
            content:
              `🚫 <@${message.author.id}> هذه الرسالة ممنوعة.`
          })
          .catch(
            () => null
          );

      if (warning) {

        setTimeout(
          () => {
            warning
              .delete()
              .catch(
                () => {}
              );
          },
          5000
        );

      }

      return;
    }

    // Anti Spam
    const now =
      Date.now();

    const last =
      lastMessage.get(
        message.author.id
      ) || 0;

    if (
      now - last < 10000
    ) {

      await message.delete()
        .catch(() => {});

      const warning =
        await message.channel
          .send({
            content:
              `⏳ <@${message.author.id}> انتظر **10 ثوانٍ** قبل إرسال رسالة أخرى.`
          })
          .catch(
            () => null
          );

      if (warning) {

        setTimeout(
          () => {
            warning
              .delete()
              .catch(
                () => {}
              );
          },
          5000
        );

      }

      return;
    }

    lastMessage.set(
      message.author.id,
      now
    );

  }
);

// =====================================================
// التفاعلات
// =====================================================

client.on(
  "interactionCreate",
  async interaction => {

    // =================================================
    // الأزرار
    // =================================================

    if (
      interaction.isButton()
    ) {

      // ===============================================
      // فتح التكت
      // ===============================================

      if (
        interaction.customId ===
        "open_ticket"
      ) {

        await interaction.deferReply({
          ephemeral: true
        });

        const guild =
          interaction.guild;

        const member =
          interaction.member;

        try {

          const existing =
            guild.channels.cache.find(
              channel =>
                channel.type ===
                  ChannelType.GuildText &&
                channel.topic ===
                  `ticket-owner:${member.id}`
            );

          if (existing) {

            return interaction.editReply({
              content:
                `❌ لديك تكت مفتوحة بالفعل: ${existing}`
            });

          }

          let username =
            member.user.username
              .toLowerCase()
              .replace(
                /[^a-z0-9-_]/g,
                ""
              )
              .slice(
                0,
                15
              );

          if (!username) {
            username = "user";
          }

          const channel =
            await guild.channels.create({
              name:
                `ticket-${username}`,

              type:
                ChannelType.GuildText,

              topic:
                `ticket-owner:${member.id}`,

              permissionOverwrites: [

                {
                  id:
                    guild.id,

                  deny: [
                    PermissionsBitField.Flags.ViewChannel
                  ]
                },

                {
                  id:
                    member.id,

                  allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory
                  ]
                }

              ]

            });

          // =============================================
          // إعطاء صلاحيات رتب الإدارة
          // =============================================

          for (
            const roleName of STAFF_ROLES
          ) {

            const role =
              guild.roles.cache.find(
                r =>
                  r.name.toLowerCase() ===
                  roleName.toLowerCase()
              );

            if (role) {

              await channel.permissionOverwrites
                .create(
                  role,
                  {
                    ViewChannel:
                      true,

                    SendMessages:
                      true,

                    ReadMessageHistory:
                      true
                  }
                )
                .catch(
                  () => {}
                );

            }

          }

          // =============================================
          // حفظ التكت
          // =============================================

          const guildData =
            getGuildData(
              guild.id
            );

          guildData.tickets[
            channel.id
          ] = {

            ownerId:
              member.id,

            claimedBy:
              null,

            claimCount:
              {}

          };

          saveData();

          // =============================================
          // منشن الإدارة
          // =============================================

          const mentions = [];

          for (
            const roleName of STAFF_ROLES
          ) {

            const role =
              guild.roles.cache.find(
                r =>
                  r.name.toLowerCase() ===
                  roleName.toLowerCase()
              );

            if (role) {

              mentions.push(
                `<@&${role.id}>`
              );

            }

          }

          // =============================================
          // Embed
          // =============================================

          const embed =
            new EmbedBuilder()
              .setTitle(
                `🎫 تكت الدعم | ${SERVER_NAME}`
              )
              .setDescription(
                `مرحباً <@${member.id}> 👋\n\n` +
                `تم فتح التكت الخاصة بك بنجاح.\n\n` +
                `👤 **صاحب التكت:** <@${member.id}>\n` +
                `🛡️ **الإدارة:** سيتم الرد عليك قريباً.\n\n` +
                `✏️ اكتب طلبك بالتفصيل وانتظر فريق الإدارة.`
              )
              .setFooter({
                text:
                  SERVER_NAME
              });

          // =============================================
          // الأزرار
          // =============================================

          const buttons =
            new ActionRowBuilder()
              .addComponents(

                new ButtonBuilder()
                  .setCustomId(
                    "ticket_claim"
                  )
                  .setLabel(
                    "استلام التكت"
                  )
                  .setStyle(
                    ButtonStyle.Primary
                  ),

                new ButtonBuilder()
                  .setCustomId(
                    "ticket_close"
                  )
                  .setLabel(
                    "إغلاق التكت"
                  )
                  .setStyle(
                    ButtonStyle.Danger
                  )

              );

          // =============================================
          // رسالة التكت
          // =============================================

          await channel.send({

            content:
              `<@${member.id}>` +
              (
                mentions.length
                  ? `\n${mentions.join(" ")}`
                  : ""
              ),

            embeds: [
              embed
            ],

            components: [
              buttons
            ]

          });

          await interaction.editReply({
            content:
              `✅ تم فتح تكتك بنجاح: ${channel}`
          });

          console.log(
            `🎫 تم إنشاء تكت ${channel.name}`
          );

        } catch (error) {

          console.error(
            "❌ خطأ أثناء إنشاء التكت:",
            error
          );

          await interaction.editReply({
            content:
              "❌ حدث خطأ أثناء إنشاء التكت. تأكد من صلاحيات البوت."
          })
          .catch(
            () => {}
          );

        }

        return;
      }

      // ===============================================
      // استلام التكت
      // ===============================================

      if (
        interaction.customId ===
        "ticket_claim"
      ) {

        const member =
          interaction.member;

        const channel =
          interaction.channel;

        if (
          !isStaff(member)
        ) {

          return interaction.reply({
            content:
              "❌ هذا الزر للإدارة فقط.",
            ephemeral: true
          });

        }

        const guildData =
          getGuildData(
            interaction.guild.id
          );

        const ticket =
          guildData.tickets[
            channel.id
          ];

        if (!ticket) {

          return interaction.reply({
            content:
              "❌ هذه القناة ليست تكت.",
            ephemeral: true
          });

        }

        if (
          ticket.ownerId ===
          member.id
        ) {

          return interaction.reply({
            content:
              "❌ لا يمكنك استلام التكت التي فتحتها.",
            ephemeral: true
          });

        }

        if (
          ticket.claimedBy &&
          ticket.claimedBy !==
            member.id
        ) {

          return interaction.reply({
            content:
              `❌ التكت مستلمة بواسطة <@${ticket.claimedBy}>.`,
            ephemeral: true
          });

        }

        ticket.claimCount[
          member.id
        ] ||= 0;

        ticket.claimCount[
          member.id
        ]++;

        // أول Claim = +3
        if (
          ticket.claimCount[
            member.id
          ] === 1
        ) {

          ticket.claimedBy =
            member.id;

          const points =
            addPoints(
              interaction.guild.id,
              member.id,
              3
            );

          return interaction.reply({
            content:
              `✅ تم استلام التكت.\n\n` +
              `⭐ **+3 نقاط**\n` +
              `📊 نقاطك الآن: **${points}**`
          });

        }

        // Claim ثاني = -50
        const points =
          addPoints(
            interaction.guild.id,
            member.id,
            -50
          );

        return interaction.reply({
          content:
            `⚠️ Claim ثاني لنفس التكت.\n\n` +
            `❌ **-50 نقطة**\n` +
            `📊 نقاطك الآن: **${points}**`
        });

      }

      // ===============================================
      // إغلاق التكت
      // ===============================================

      if (
        interaction.customId ===
        "ticket_close"
      ) {

        const member =
          interaction.member;

        const channel =
          interaction.channel;

        const guildData =
          getGuildData(
            interaction.guild.id
          );

        const ticket =
          guildData.tickets[
            channel.id
          ];

        if (!ticket) {

          return interaction.reply({
            content:
              "❌ هذه ليست تكت.",
            ephemeral: true
          });

        }

        if (
          ticket.ownerId ===
          member.id
        ) {

          return interaction.reply({
            content:
              "❌ لا يمكنك إغلاق التكت التي فتحتها.",
            ephemeral: true
          });

        }

        if (
          !isStaff(member)
        ) {

          return interaction.reply({
            content:
              "❌ الإدارة فقط تستطيع إغلاق التكت.",
            ephemeral: true
          });

        }

        await interaction.reply({
          content:
            "🔒 سيتم إغلاق التكت خلال 5 ثوانٍ..."
        });

        setTimeout(
          async () => {

            delete guildData.tickets[
              channel.id
            ];

            saveData();

            await channel
              .delete()
              .catch(
                () => {}
              );

          },
          5000
        );

        return;
      }

    }

    // =================================================
    // Slash Commands
    // =================================================

    if (
      !interaction.isChatInputCommand()
    ) {
      return;
    }

    // =================================================
    // /ip
    // =================================================

    if (
      interaction.commandName ===
      "ip"
    ) {

      return interaction.reply({

        embeds: [

          new EmbedBuilder()
            .setTitle(
              `🌐 ${SERVER_NAME}`
            )
            .setDescription(
              `**IP السيرفر:**\n\`${SERVER_IP}\``
            )
            .setFooter({
              text:
                SERVER_NAME
            })

        ]

      });

    }

    // =================================================
    // /points
    // =================================================

    if (
      interaction.commandName ===
      "points"
    ) {

      const points =
        getPoints(
          interaction.guild.id,
          interaction.user.id
        );

      return interaction.reply({

        embeds: [

          new EmbedBuilder()
            .setTitle(
              "📊 نقاط الإدارة"
            )
            .setDescription(
              `👤 **العضو:** ${interaction.user}\n\n` +
              `⭐ **النقاط:** ${points}`
            )
            .setFooter({
              text:
                SERVER_NAME
            })

        ],

        ephemeral:
          true

      });

    }

    // =================================================
    // /addpoints
    // =================================================

    if (
      interaction.commandName ===
      "addpoints"
    ) {

      const member =
        interaction.member;

      // Owner فقط
      if (
        !hasRole(
          member,
          "Owner"
        )
      ) {

        return interaction.reply({
          content:
            "❌ هذا الأمر متاح للـ **Owner** فقط.",
          ephemeral: true
        });

      }

      const target =
        interaction.options.getUser(
          "member"
        );

      const amount =
        interaction.options.getInteger(
          "amount"
        );

      const points =
        addPoints(
          interaction.guild.id,
          target.id,
          amount
        );

      return interaction.reply({

        embeds: [

          new EmbedBuilder()
            .setTitle(
              "⭐ إضافة نقاط"
            )
            .setDescription(
              `👤 **العضو:** <@${target.id}>\n\n` +
              `➕ **تمت إضافة:** ${amount} نقطة\n\n` +
              `📊 **نقاطه الآن:** ${points}`
            )
            .setFooter({
              text:
                SERVER_NAME
            })

        ]

      });

    }

    // =================================================
    // /minuspoints
    // =================================================

    if (
      interaction.commandName ===
      "minuspoints"
    ) {

      const member =
        interaction.member;

      // Owner فقط
      if (
        !hasRole(
          member,
          "Owner"
        )
      ) {

        return interaction.reply({
          content:
            "❌ هذا الأمر متاح للـ **Owner** فقط.",
          ephemeral: true
        });

      }

      const target =
        interaction.options.getUser(
          "member"
        );

      const amount =
        interaction.options.getInteger(
          "amount"
        );

      const points =
        addPoints(
          interaction.guild.id,
          target.id,
          -amount
        );

      return interaction.reply({

        embeds: [

          new EmbedBuilder()
            .setTitle(
              "➖ خصم نقاط"
            )
            .setDescription(
              `👤 **العضو:** <@${target.id}>\n\n` +
              `➖ **تم خصم:** ${amount} نقطة\n\n` +
              `📊 **نقاطه الآن:** ${points}`
            )
            .setFooter({
              text:
                SERVER_NAME
            })

        ]

      });

    }

    // =================================================
    // /salary
    // =================================================

    if (
      interaction.commandName ===
      "salary"
    ) {

      const member =
        interaction.member;

      if (
        !isSeniorStaff(member)
      ) {

        return interaction.reply({
          content:
            "❌ الراتب متاح من **Sr Mod** فما فوق.",
          ephemeral: true
        });

      }

      const guildData =
        getGuildData(
          interaction.guild.id
        );

      const now =
        Date.now();

      const last =
        Number(
          guildData.salary[
            member.id
          ] || 0
        );

      const DAY =
        24 *
        60 *
        60 *
        1000;

      if (
        now - last < DAY
      ) {

        const remaining =
          DAY -
          (now - last);

        const hours =
          Math.floor(
            remaining /
            3600000
          );

        const minutes =
          Math.floor(
            (
              remaining %
              3600000
            ) /
            60000
          );

        return interaction.reply({
          content:
            `❌ استلمت راتبك مسبقاً.\n` +
            `⏰ المتبقي: **${hours} ساعة و ${minutes} دقيقة**`,
          ephemeral: true
        });

      }

      // تسجيل استلام الراتب
      guildData.salary[
        member.id
      ] = now;

      // الراتب = +12 نقطة
      // ولا يتم تغيير أي رتبة
      const points =
        addPoints(
          interaction.guild.id,
          member.id,
          12
        );

      return interaction.reply({

        embeds: [

          new EmbedBuilder()
            .setTitle(
              "💰 راتب الإدارة"
            )
            .setDescription(
              `✅ تم استلام الراتب.\n\n` +
              `⭐ **+12 نقطة**\n\n` +
              `📊 نقاطك الآن: **${points}**`
            )
            .setFooter({
              text:
                SERVER_NAME
            })

        ]

      });

    }

    // =================================================
    // /claim
    // =================================================

    if (
      interaction.commandName ===
      "claim"
    ) {

      const member =
        interaction.member;

      if (
        !isStaff(member)
      ) {

        return interaction.reply({
          content:
            "❌ هذا الأمر للإدارة فقط.",
          ephemeral: true
        });

      }

      const guildData =
        getGuildData(
          interaction.guild.id
        );

      const ticket =
        guildData.tickets[
          interaction.channel.id
        ];

      if (!ticket) {

        return interaction.reply({
          content:
            "❌ استخدم الأمر داخل التكت.",
          ephemeral: true
        });

      }

      if (
        ticket.ownerId ===
        member.id
      ) {

        return interaction.reply({
          content:
            "❌ لا يمكنك استلام التكت التي فتحتها.",
          ephemeral: true
        });

      }

      if (
        ticket.claimedBy &&
        ticket.claimedBy !==
          member.id
      ) {

        return interaction.reply({
          content:
            `❌ التكت مستلمة بواسطة <@${ticket.claimedBy}>.`,
          ephemeral: true
        });

      }

      ticket.claimCount[
        member.id
      ] ||= 0;

      ticket.claimCount[
        member.id
      ]++;

      // أول Claim = +3
      if (
        ticket.claimCount[
          member.id
        ] === 1
      ) {

        ticket.claimedBy =
          member.id;

        const points =
          addPoints(
            interaction.guild.id,
            member.id,
            3
          );

        return interaction.reply({
          content:
            `✅ تم استلام التكت.\n` +
            `⭐ **+3 نقاط**\n` +
            `📊 نقاطك: **${points}**`
        });

      }

      // Claim ثاني = -50
      const points =
        addPoints(
          interaction.guild.id,
          member.id,
          -50
        );

      return interaction.reply({
        content:
          `⚠️ Claim ثاني لنفس التكت.\n` +
          `❌ **-50 نقطة**\n` +
          `📊 نقاطك: **${points}**`
      });

    }

    // =================================================
    // /warn
    // =================================================

    if (
      interaction.commandName ===
      "warn"
    ) {

      const moderator =
        interaction.member;

      if (
        !isSeniorStaff(
          moderator
        )
      ) {

        return interaction.reply({
          content:
            "❌ أمر Warn متاح من **Sr Mod** فما فوق.",
          ephemeral: true
        });

      }

      const target =
        interaction.options.getMember(
          "member"
        );

      const reason =
        interaction.options.getString(
          "reason"
        );

      if (!target) {

        return interaction.reply({
          content:
            "❌ لم أجد العضو.",
          ephemeral: true
        });

      }

      if (
        target.user.bot
      ) {

        return interaction.reply({
          content:
            "❌ لا يمكنك تحذير البوتات.",
          ephemeral: true
        });

      }

      if (
        target.id ===
        moderator.id
      ) {

        return interaction.reply({
          content:
            "❌ لا يمكنك تحذير نفسك.",
          ephemeral: true
        });

      }

      if (
        target.roles.highest.position >=
        moderator.roles.highest.position
      ) {

        return interaction.reply({
          content:
            "❌ لا يمكنك تحذير عضو رتبته مساوية أو أعلى من رتبتك.",
          ephemeral: true
        });

      }

      const guildData =
        getGuildData(
          interaction.guild.id
        );

      guildData.warns[
        target.id
      ] ||= 0;

      guildData.warns[
        target.id
      ]++;

      const warnNumber =
        guildData.warns[
          target.id
        ];

      saveData();

      // Warn 1
      if (
        warnNumber === 1
      ) {

        return interaction.reply({
          embeds: [

            new EmbedBuilder()
              .setTitle(
                "⚠️ التحذير الأول"
              )
              .setDescription(
                `👤 **العضو:** ${target}\n` +
                `🛡️ **بواسطة:** ${moderator}\n` +
                `📝 **السبب:** ${reason}\n\n` +
                `⚠️ تم تسجيل **التحذير الأول**.`
              )
              .setFooter({
                text:
                  SERVER_NAME
              })

          ]
        });

      }

      // Warn 2
      if (
        warnNumber === 2
      ) {

        return interaction.reply({
          embeds: [

            new EmbedBuilder()
              .setTitle(
                "⚠️ التحذير الثاني"
              )
              .setDescription(
                `👤 **العضو:** ${target}\n` +
                `🛡️ **بواسطة:** ${moderator}\n` +
                `📝 **السبب:** ${reason}\n\n` +
                `⚠️ تم تسجيل **التحذير الثاني**.`
              )
              .setFooter({
                text:
                  SERVER_NAME
              })

          ]
        });

      }

      // Warn 3
      if (
        warnNumber === 3
      ) {

        return interaction.reply({
          embeds: [

            new EmbedBuilder()
              .setTitle(
                "⚠️ التحذير الثالث"
              )
              .setDescription(
                `👤 **العضو:** ${target}\n` +
                `🛡️ **بواسطة:** ${moderator}\n` +
                `📝 **السبب:** ${reason}\n\n` +
                `⚠️ تم تسجيل **التحذير الثالث**.\n` +
                `🔇 التحذير القادم = ميوت يوم كامل.`
              )
              .setFooter({
                text:
                  SERVER_NAME
              })

          ]
        });

      }

      // Warn 4
      if (
        warnNumber === 4
      ) {

        try {

          await target.timeout(
            24 *
            60 *
            60 *
            1000,

            `Warn 4: ${reason}`
          );

        } catch {

          return interaction.reply({
            content:
              "⚠️ تم تسجيل التحذير الرابع، لكن لم أستطع عمل الميوت.",
            ephemeral: true
          });

        }

        return interaction.reply({
          embeds: [

            new EmbedBuilder()
              .setTitle(
                "🔇 التحذير الرابع"
              )
              .setDescription(
                `👤 **العضو:** ${target}\n` +
                `🛡️ **بواسطة:** ${moderator}\n` +
                `📝 **السبب:** ${reason}\n\n` +
                `🔇 تم عمل **ميوت لمدة 24 ساعة**.`
              )
              .setFooter({
                text:
                  SERVER_NAME
              })

          ]
        });

      }

      // Warn 5
      if (
        warnNumber === 5
      ) {

        try {

          await target.kick(
            `Warn 5: ${reason}`
          );

        } catch {

          return interaction.reply({
            content:
              "⚠️ تم تسجيل التحذير الخامس، لكن لم أستطع طرد العضو.",
            ephemeral: true
          });

        }

        return interaction.reply({
          embeds: [

            new EmbedBuilder()
              .setTitle(
                "👢 التحذير الخامس"
              )
              .setDescription(
                `👤 **العضو:** ${target.user.tag}\n` +
                `🛡️ **بواسطة:** ${moderator}\n` +
                `📝 **السبب:** ${reason}\n\n` +
                `👢 تم **طرد العضو من السيرفر**.`
              )
              .setFooter({
                text:
                  SERVER_NAME
              })

          ]
        });

      }

      // Warn 6+
      if (
        warnNumber >= 6
      ) {

        try {

          await target.ban({
            reason:
              `Warn 6: ${reason}`
          });

        } catch {

          return interaction.reply({
            content:
              "⚠️ تم تسجيل التحذير السادس، لكن لم أستطع حظر العضو.",
            ephemeral: true
          });

        }

        return interaction.reply({
          embeds: [

            new EmbedBuilder()
              .setTitle(
                "🔨 التحذير السادس"
              )
              .setDescription(
                `👤 **العضو:** ${target.user.tag}\n` +
                `🛡️ **بواسطة:** ${moderator}\n` +
                `📝 **السبب:** ${reason}\n\n` +
                `🔨 تم **حظر العضو من السيرفر**.`
              )
              .setFooter({
                text:
                  SERVER_NAME
              })

          ]
        });

      }

    }

    // =================================================
    // /staffrequest
    // =================================================

    if (
      interaction.commandName ===
      "staffrequest"
    ) {

      const member =
        interaction.member;

      if (
        !isStaff(member)
      ) {

        return interaction.reply({
          content:
            "❌ هذا الأمر للإدارة فقط.",
          ephemeral: true
        });

      }

      const mentions = [];

      for (
        const roleName of SENIOR_STAFF_ROLES
      ) {

        const role =
          interaction.guild.roles.cache.find(
            r =>
              r.name.toLowerCase() ===
              roleName.toLowerCase()
          );

        if (role) {

          mentions.push(
            `<@&${role.id}>`
          );

        }

      }

      return interaction.reply({
        content:
          `📢 **طلب حضور الإدارة**\n\n` +
          `<@${member.id}> يحتاج حضور الإدارة.\n\n` +
          (
            mentions.length
              ? mentions.join(" ")
              : "لم يتم العثور على رتب الإدارة العليا."
          )
      });

    }

    // =================================================
    // /setup-ticket
    // =================================================

    if (
      interaction.commandName ===
      "setup-ticket"
    ) {

      if (
        !interaction.member.permissions.has(
          PermissionsBitField.Flags.Administrator
        )
      ) {

        return interaction.reply({
          content:
            "❌ هذا الأمر للأدمن فقط.",
          ephemeral: true
        });

      }

      const embed =
        new EmbedBuilder()
          .setTitle(
            `🎫 تذاكر الدعم | ${SERVER_NAME}`
          )
          .setDescription(
            "اضغط على الزر بالأسفل لفتح تكت.\n\n" +
            "سيتم إنشاء تكت خاصة بك وإشعار جميع رتب الإدارة."
          )
          .setFooter({
            text:
              SERVER_NAME
          });

      const row =
        new ActionRowBuilder()
          .addComponents(

            new ButtonBuilder()
              .setCustomId(
                "open_ticket"
              )
              .setLabel(
                "فتح تكت"
              )
              .setEmoji(
                "🎫"
              )
              .setStyle(
                ButtonStyle.Success
              )

          );

      return interaction.reply({
        embeds: [
          embed
        ],
        components: [
          row
        ]
      });

    }

    // =================================================
    // /quran
    // =================================================

    if (
      interaction.commandName ===
      "quran"
    ) {

      const member =
        interaction.member;

      if (
        !member.voice.channel
      ) {

        return interaction.reply({
          content:
            "❌ ادخل روم صوتي أولاً ثم استخدم `/quran`.",
          ephemeral: true
        });

      }

      const voiceChannel =
        member.voice.channel;

      const permissions =
        voiceChannel.permissionsFor(
          interaction.guild.members.me
        );

      if (
        !permissions ||
        !permissions.has(
          PermissionsBitField.Flags.Connect
        ) ||
        !permissions.has(
          PermissionsBitField.Flags.Speak
        )
      ) {

        return interaction.reply({
          content:
            "❌ البوت يحتاج صلاحية **Connect** و **Speak** في الروم الصوتي.",
          ephemeral: true
        });

      }

      try {

        playQuran(
          interaction.guild,
          voiceChannel
        );

        return interaction.reply({
          embeds: [

            new EmbedBuilder()
              .setTitle(
                "📖 Boti | القرآن الكريم"
              )
              .setDescription(
                `✅ دخلت الروم الصوتي <#${voiceChannel.id}> وبدأت تلاوة القرآن.\n\n` +
                `⏹️ لإيقاف التلاوة استخدم:\n` +
                `\`/quran-stop\``
              )
              .setFooter({
                text:
                  SERVER_NAME
              })

          ]
        });

      } catch (error) {

        console.error(
          "❌ خطأ تشغيل القرآن:",
          error
        );

        return interaction.reply({
          content:
            "❌ لم أستطع تشغيل التلاوة. تأكد أن حزمة FFmpeg مثبتة في Railway.",
          ephemeral: true
        });

      }

    }

    // =================================================
    // /quran-stop
    // =================================================

    if (
      interaction.commandName ===
      "quran-stop"
    ) {

      const stopped =
        stopQuran(
          interaction.guild.id
        );

      if (!stopped) {

        return interaction.reply({
          content:
            "❌ البوت لا يشغل القرآن حاليًا.",
          ephemeral: true
        });

      }

      return interaction.reply({
        content:
          "⏹️ تم إيقاف تلاوة القرآن وخروج Boti من الروم الصوتي."
      });

    }

  }
);

// =====================================================
// أخطاء البوت
// =====================================================

client.on(
  "error",
  error => {

    console.error(
      "❌ Discord Client Error:",
      error
    );

  }
);

process.on(
  "unhandledRejection",
  error => {

    console.error(
      "❌ Unhandled Rejection:",
      error
    );

  }
);

// =====================================================
// تشغيل البوت
// =====================================================

client.login(
  TOKEN
);
