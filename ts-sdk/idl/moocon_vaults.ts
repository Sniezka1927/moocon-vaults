/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/moocon_vaults.json`.
 */
export type MooconVaults = {
  "address": "26WWiEiNHYzksQsp9KBfa4acAyoKPnS2Ssp24Uv756S4",
  "metadata": {
    "name": "mooconVaults",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "claim",
      "discriminator": [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
        210
      ],
      "accounts": [
        {
          "name": "claimer",
          "writable": true,
          "signer": true
        },
        {
          "name": "state",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "vaultIndex"
              }
            ]
          }
        },
        {
          "name": "reward",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  119,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "arg",
                "path": "round"
              }
            ]
          }
        },
        {
          "name": "pMint",
          "writable": true
        },
        {
          "name": "claimerPTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "claimer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "pMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rentRecipient",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "vaultIndex",
          "type": "u32"
        },
        {
          "name": "round",
          "type": "u32"
        }
      ]
    },
    {
      "name": "collectFee",
      "discriminator": [
        60,
        173,
        247,
        103,
        4,
        93,
        130,
        48
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "state"
          ]
        },
        {
          "name": "state",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "vaultIndex"
              }
            ]
          }
        },
        {
          "name": "vaultFTokenAccount",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "adminTokenAccount",
          "writable": true
        },
        {
          "name": "mint"
        },
        {
          "name": "lendingAdmin"
        },
        {
          "name": "lending",
          "writable": true
        },
        {
          "name": "fTokenMint",
          "writable": true
        },
        {
          "name": "supplyTokenReservesLiquidity",
          "writable": true
        },
        {
          "name": "lendingSupplyPositionOnLiquidity",
          "writable": true
        },
        {
          "name": "rateModel"
        },
        {
          "name": "lendingVault",
          "writable": true
        },
        {
          "name": "claimAccount",
          "writable": true
        },
        {
          "name": "liquidity",
          "writable": true
        },
        {
          "name": "liquidityProgram",
          "writable": true
        },
        {
          "name": "rewardsRateModel"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "vaultIndex",
          "type": "u32"
        }
      ]
    },
    {
      "name": "commit",
      "discriminator": [
        223,
        140,
        142,
        165,
        229,
        208,
        156,
        74
      ],
      "accounts": [
        {
          "name": "vrfAuthority",
          "writable": true,
          "signer": true,
          "relations": [
            "state"
          ]
        },
        {
          "name": "state",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "vaultIndex"
              }
            ]
          }
        },
        {
          "name": "lending",
          "writable": true
        },
        {
          "name": "mint"
        },
        {
          "name": "vaultFTokenAccount",
          "docs": [
            "Vault's fToken account — read balance + burn fTokens during withdraw CPI"
          ],
          "writable": true
        },
        {
          "name": "fTokenMint",
          "writable": true
        },
        {
          "name": "reward",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  119,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "arg",
                "path": "round"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "networkState",
          "writable": true
        },
        {
          "name": "request",
          "writable": true
        },
        {
          "name": "vrf",
          "address": "VRFzZoJdhFWL8rkvu87LpKM3RbcVezpMEc6X5GVDr7y"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "vaultIndex",
          "type": "u32"
        },
        {
          "name": "round",
          "type": "u32"
        },
        {
          "name": "rewardType",
          "type": "u8"
        },
        {
          "name": "tickets",
          "type": "u64"
        },
        {
          "name": "merkleRoot",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "secretHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "state",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "premiumVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "vaultIndex"
              }
            ]
          }
        },
        {
          "name": "depositorTokenAccount",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "recipientTokenAccount",
          "writable": true
        },
        {
          "name": "mint"
        },
        {
          "name": "pMint",
          "writable": true
        },
        {
          "name": "depositorPTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "depositor"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "pMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "lendingAdmin"
        },
        {
          "name": "lending",
          "writable": true
        },
        {
          "name": "fTokenMint",
          "writable": true
        },
        {
          "name": "supplyTokenReservesLiquidity",
          "writable": true
        },
        {
          "name": "lendingSupplyPositionOnLiquidity",
          "writable": true
        },
        {
          "name": "rateModel"
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "liquidity",
          "writable": true
        },
        {
          "name": "liquidityProgram",
          "writable": true
        },
        {
          "name": "rewardsRateModel"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "lendingProgram"
        }
      ],
      "args": [
        {
          "name": "vaultIndex",
          "type": "u32"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "state",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "vrfAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initializeVault",
      "discriminator": [
        48,
        191,
        163,
        44,
        71,
        129,
        63,
        164
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "state"
          ]
        },
        {
          "name": "state",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "state"
              }
            ]
          }
        },
        {
          "name": "lending"
        },
        {
          "name": "mint"
        },
        {
          "name": "fMint"
        },
        {
          "name": "pMint"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "minDeposit",
          "type": "u64"
        },
        {
          "name": "withdrawFee",
          "type": "u64"
        },
        {
          "name": "tiers",
          "type": {
            "array": [
              {
                "defined": {
                  "name": "distributionTier"
                }
              },
              2
            ]
          }
        }
      ]
    },
    {
      "name": "reveal",
      "discriminator": [
        9,
        35,
        59,
        190,
        167,
        249,
        76,
        115
      ],
      "accounts": [
        {
          "name": "vrfAuthority",
          "signer": true,
          "relations": [
            "state"
          ]
        },
        {
          "name": "state",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "vaultIndex"
              }
            ]
          }
        },
        {
          "name": "reward",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  119,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "arg",
                "path": "round"
              }
            ]
          }
        },
        {
          "name": "request"
        },
        {
          "name": "winner"
        }
      ],
      "args": [
        {
          "name": "vaultIndex",
          "type": "u32"
        },
        {
          "name": "round",
          "type": "u32"
        },
        {
          "name": "secretSeed",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "setVrfAuthority",
      "discriminator": [
        219,
        49,
        136,
        166,
        71,
        6,
        51,
        74
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "state"
          ]
        },
        {
          "name": "state",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newVrfAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setWithdrawFee",
      "discriminator": [
        33,
        223,
        102,
        118,
        225,
        116,
        8,
        238
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "state"
          ]
        },
        {
          "name": "state",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "vaultIndex"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "vaultIndex",
          "type": "u32"
        },
        {
          "name": "withdrawFee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "syncRate",
      "discriminator": [
        44,
        249,
        76,
        136,
        3,
        137,
        49,
        247
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "state"
          ]
        },
        {
          "name": "state",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "vaultIndex"
              }
            ]
          }
        },
        {
          "name": "lending"
        }
      ],
      "args": [
        {
          "name": "vaultIndex",
          "type": "u32"
        }
      ]
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "withdrawer",
          "signer": true
        },
        {
          "name": "premiumVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "vaultIndex"
              }
            ]
          }
        },
        {
          "name": "vaultFTokenAccount",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "withdrawerTokenAccount",
          "writable": true
        },
        {
          "name": "mint"
        },
        {
          "name": "pMint",
          "writable": true
        },
        {
          "name": "withdrawerPTokenAccount",
          "writable": true
        },
        {
          "name": "lendingAdmin"
        },
        {
          "name": "lending",
          "writable": true
        },
        {
          "name": "fTokenMint",
          "writable": true
        },
        {
          "name": "supplyTokenReservesLiquidity",
          "writable": true
        },
        {
          "name": "lendingSupplyPositionOnLiquidity",
          "writable": true
        },
        {
          "name": "rateModel"
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "claimAccount",
          "writable": true
        },
        {
          "name": "liquidity",
          "writable": true
        },
        {
          "name": "liquidityProgram",
          "writable": true
        },
        {
          "name": "rewardsRateModel"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "lendingProgram"
        }
      ],
      "args": [
        {
          "name": "vaultIndex",
          "type": "u32"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "networkState",
      "discriminator": [
        212,
        237,
        148,
        56,
        97,
        245,
        51,
        169
      ]
    },
    {
      "name": "reward",
      "discriminator": [
        174,
        129,
        42,
        212,
        190,
        18,
        45,
        34
      ]
    },
    {
      "name": "state",
      "discriminator": [
        216,
        146,
        107,
        94,
        104,
        75,
        182,
        177
      ]
    },
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    }
  ],
  "events": [
    {
      "name": "commitEvent",
      "discriminator": [
        252,
        78,
        246,
        83,
        244,
        83,
        218,
        56
      ]
    },
    {
      "name": "revealEvent",
      "discriminator": [
        51,
        6,
        123,
        75,
        48,
        187,
        64,
        1
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "randomnessNotFulfilled",
      "msg": "Randomness has not been fulfilled yet"
    },
    {
      "code": 6001,
      "name": "zeroAmount",
      "msg": "zeroAmount"
    },
    {
      "code": 6002,
      "name": "cpiFailed",
      "msg": "CPI to Jup program failed"
    },
    {
      "code": 6003,
      "name": "invalidMint",
      "msg": "Provided invalid mint"
    },
    {
      "code": 6004,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6005,
      "name": "alreadySynced",
      "msg": "Exchange rate already synced"
    },
    {
      "code": 6006,
      "name": "notSynced",
      "msg": "Exchange rate not synced yet"
    },
    {
      "code": 6007,
      "name": "invalidExchangeRate",
      "msg": "Invalid exchange rate data"
    },
    {
      "code": 6008,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6009,
      "name": "winnerNotSet",
      "msg": "Winner not yet assigned"
    },
    {
      "code": 6010,
      "name": "alreadyClaimed",
      "msg": "Reward already claimed"
    },
    {
      "code": 6011,
      "name": "notWinner",
      "msg": "Not the winner"
    },
    {
      "code": 6012,
      "name": "nothingToClaim",
      "msg": "No yield to claim"
    },
    {
      "code": 6013,
      "name": "invalidRewardType",
      "msg": "Invalid reward type"
    },
    {
      "code": 6014,
      "name": "jackpotEmpty",
      "msg": "Jackpot pool is empty"
    },
    {
      "code": 6015,
      "name": "invalidFee",
      "msg": "Fee exceeds maximum"
    },
    {
      "code": 6016,
      "name": "invalidPMint",
      "msg": "Invalid PMint"
    },
    {
      "code": 6017,
      "name": "mismatchedDecimals",
      "msg": "Mismatched decimals between mint and pMint"
    },
    {
      "code": 6018,
      "name": "invalidRandomnessAccount",
      "msg": "Invalid randomness account"
    },
    {
      "code": 6019,
      "name": "invalidLendingProgram",
      "msg": "Invalid lending program"
    },
    {
      "code": 6020,
      "name": "invalidLendingAccount",
      "msg": "Invalid lending account"
    },
    {
      "code": 6021,
      "name": "insufficientFunds",
      "msg": "Insufficient funds"
    },
    {
      "code": 6022,
      "name": "invalidRound",
      "msg": "Invalid Round"
    },
    {
      "code": 6023,
      "name": "belowMinimumDeposit",
      "msg": "Below minimum deposit"
    },
    {
      "code": 6024,
      "name": "invalidVaultShare",
      "msg": "Invalid Vault share"
    }
  ],
  "types": [
    {
      "name": "commitEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "round",
            "type": "u32"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "merkleRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "secretHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "vrfSeed",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "distributionTier",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "distributedAt",
            "type": "i64"
          },
          {
            "name": "interval",
            "type": "i64"
          },
          {
            "name": "rewardShare",
            "type": "u64"
          },
          {
            "name": "accumulated",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "networkConfiguration",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "requestFee",
            "type": "u64"
          },
          {
            "name": "fulfillmentAuthorities",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "tokenFeeConfig",
            "type": {
              "option": {
                "defined": {
                  "name": "oraoTokenFeeConfig"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "networkState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": {
              "defined": {
                "name": "networkConfiguration"
              }
            }
          },
          {
            "name": "numReceived",
            "docs": [
              "Total number of received requests."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "oraoTokenFeeConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "docs": [
              "ORAO token mint address."
            ],
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "docs": [
              "ORAO token treasury account."
            ],
            "type": "pubkey"
          },
          {
            "name": "fee",
            "docs": [
              "Fee in ORAO SPL token smallest units."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "revealEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "round",
            "type": "u32"
          },
          {
            "name": "secretSeed",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "randomness",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "winnerIndex",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "reward",
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "claimer",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "totalTickets",
            "type": "u64"
          },
          {
            "name": "winnerIndex",
            "type": "u64"
          },
          {
            "name": "round",
            "type": "u32"
          },
          {
            "name": "rewardType",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                2
              ]
            }
          }
        ]
      }
    },
    {
      "name": "state",
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "vrfAuthority",
            "type": "pubkey"
          },
          {
            "name": "lastVault",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          }
        ]
      }
    },
    {
      "name": "vault",
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "fMint",
            "type": "pubkey"
          },
          {
            "name": "pMint",
            "type": "pubkey"
          },
          {
            "name": "lending",
            "type": "pubkey"
          },
          {
            "name": "minDeposit",
            "type": "u64"
          },
          {
            "name": "accumulatedFee",
            "type": "u64"
          },
          {
            "name": "withdrawFee",
            "type": "u64"
          },
          {
            "name": "lastRate",
            "type": "u64"
          },
          {
            "name": "distributionTiers",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "distributionTier"
                  }
                },
                2
              ]
            }
          },
          {
            "name": "currentRound",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "dailyJackpotShare",
      "type": "u64",
      "value": "200000"
    },
    {
      "name": "jupiterLendingProgramId",
      "docs": [
        "https://dev.jup.ag/docs/lend/program-addresses"
      ],
      "type": "pubkey",
      "value": "5za4DTEi2hT35dWfNysVgFSeoJ93xTZsKc8Za4gfxEni"
    },
    {
      "name": "percentageDenominator",
      "type": "u64",
      "value": "1000000"
    },
    {
      "name": "rewardSeed",
      "type": "bytes",
      "value": "[114, 101, 119, 97, 114, 100]"
    },
    {
      "name": "rewardTypeDaily",
      "type": "u8",
      "value": "1"
    },
    {
      "name": "rewardTypeRound",
      "type": "u8",
      "value": "0"
    },
    {
      "name": "rewardTypeWeekly",
      "type": "u8",
      "value": "2"
    },
    {
      "name": "shareDenominator",
      "type": "u64",
      "value": "1000000"
    },
    {
      "name": "stateSeed",
      "type": "bytes",
      "value": "[115, 116, 97, 116, 101]"
    },
    {
      "name": "vaultSeed",
      "type": "bytes",
      "value": "[118, 97, 117, 108, 116]"
    },
    {
      "name": "weeklyJackpotShare",
      "type": "u64",
      "value": "200000"
    },
    {
      "name": "winnerShare",
      "type": "u64",
      "value": "600000"
    }
  ]
};
